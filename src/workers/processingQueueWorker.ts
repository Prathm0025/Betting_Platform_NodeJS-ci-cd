import { parentPort, workerData } from "worker_threads";
import mongoose from "mongoose";
import Store from "../store/storeController";
import Bet, { BetDetail } from "../bets/betModel";
import { dequeue, getAll, removeItem, size } from "../utils/ProcessingQueue";
import { config } from "../config/config";
import Player from "../players/playerModel";
import notificationController from "../notifications/notificationController";
import { IPlayer } from "../players/playerType";
import { redisClient } from "../redisclient";


async function connectDB() {
  try {
    mongoose.connection.on("connected", async () => {
      console.log("Connected to database successfully");
    });

    mongoose.connection.on("error", (err) => {
      console.log("Error in connecting to database.", err);
    });

    await mongoose.connect(config.databaseUrl as string);
  } catch (err) {
    console.error("Failed to connect to database.", err);
    process.exit(1);
  }
}

connectDB();



async function processBets(sportKeys, bets) {
  try {
    for (const sport of sportKeys) {
      const scoresData = await Store.getScoresForProcessing(sport, "3", "iso");

      if (!scoresData) {
        continue;
      }

      const { completedGames } = scoresData;
      // console.log("COMPLETED GAMES : ", scoresData);


      for (const game of completedGames) {
        const betsToBeProcess = bets.filter((b) => b.event_id === game.id);

        if (betsToBeProcess.length > 0) {
          for (const bet of betsToBeProcess) {
            try {
              await processCompletedBet(bet._id.toString(), game);
              await removeItem(JSON.stringify(bet))
            } catch (error) {
              // In case of error, mark the parent bet as unresolved
              console.error(`Error during processing of bet detail with ID ${bet._id}:`, error);

              // Retrieve the parent bet of the current bet detail
              const parentBet = await Bet.findById(bet.key); // Assuming `key` references the parent bet

              if (parentBet) {
                // Mark the parent bet as unresolved
                await Bet.findByIdAndUpdate(parentBet._id, { isResolved: false });
                console.log(`Parent Bet with ID ${parentBet._id} marked as unresolved due to an error in processing bet detail.`);
              } else {
                console.error(`Parent bet not found for bet detail ID ${bet._id}.`);
              }

              await removeItem(JSON.stringify(bet))
            }
          }
        }
      }

    }
  } catch (error) {
    console.error("Error during bet processing:", error);

  }
}

// If any bet is lost then mark it as unresolved
// and remove all the bets associated with it from waiting queue and processing queue 

async function processCompletedBet(betDetailId, gameData) {
  const maxRetries = 3;
  let retryCount = 0;
  let currentBetDetail;

  while (retryCount < maxRetries) {
    try {
      // console.log("Associated game data:", JSON.stringify(gameData, null, 2));


      // Find the current BetDetail
      currentBetDetail = await BetDetail.findById(betDetailId)
      if (!currentBetDetail) {
        console.error("BetDetail not found:", betDetailId);
        return;
      }

      // console.log("CURRENT BET : ", currentBetDetail);

      // Find the parent Bet associated with the BetDetail
      const parentBet = await Bet.findById(currentBetDetail.key);
      if (!parentBet) {
        console.error("Parent Bet not found for betDetail:", currentBetDetail._id);
        return;
      }

      // console.log("PARENT : ", parentBet);

      // Process the current bet result
      const result = checkIfPlayerWonBet(currentBetDetail, gameData);
      if (["won", "lost", "draw"].includes(result)) {
        // Update the BetDetail status
        currentBetDetail.status = result;
        await currentBetDetail.save();
        console.log(`BetDetail with ID ${currentBetDetail._id} updated to '${result}'`);
      }

      // Fetch the updated BetDetail to ensure status change
      currentBetDetail = await BetDetail.findById(currentBetDetail._id).lean();
      // console.log("UPDATED BET DETAIL: ", currentBetDetail);

      // After updating the current BetDetail, check the status of all BetDetails
      const updatedBetDetails = await BetDetail.find({ _id: { $in: parentBet.data } });

      // Log the updated details
      // console.log("UPDATED BET : ", updatedBetDetails);

      // Check if any BetDetail is lost or failed
      const anyBetLost = updatedBetDetails.some(detail => detail.status === 'lost');
      const anyBetFailed = updatedBetDetails.some(detail => detail.status === 'failed');

      // If any bet is lost, mark the parent bet as lost and stop further processing
      if (anyBetLost) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'lost', isResolved: true });
        console.log(`Parent Bet with ID ${parentBet._id} updated to 'lost'`);
        return;  // Stop processing other bet details under this parent
      }

      // If any bet fails, mark the parent bet as failed and stop further processing
      if (anyBetFailed) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'failed', isResolved: false });
        console.log(`Parent Bet with ID ${parentBet._id} updated to 'failed' due to one or more failed bets.`);
        return;  // Stop processing other bet details under this parent
      }

      // Check if all BetDetails are won
      const allBetsWon = updatedBetDetails.every(detail => detail.status === 'won');

      // console.log("ALL WON : ", allBetsWon);

      // If all BetDetails are won, mark the parent bet as won and award the winnings
      if (allBetsWon) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'won', isResolved: true });
        await awardWinningsToPlayer(parentBet.player, parentBet.possibleWinningAmount);
        console.log(`Parent Bet with ID ${parentBet._id} won and winnings awarded.`);
      } else {
        // If all bets are resolved (either won or lost), mark the parent Bet as resolved
        await Bet.findByIdAndUpdate(parentBet._id, { isResolved: true });
        console.log(`Parent Bet with ID ${parentBet._id} has been resolved.`);
      }

      break;

    } catch (error) {
      console.error("Error during processing, retrying...", error);


      // If an error occurs, mark the BetDetail as 'failed' and set isResolved to false
      if (currentBetDetail) {
        await BetDetail.findByIdAndUpdate(betDetailId, {
          status: 'failed',
          isResolved: false,
        });
        console.log(`BetDetail with ID ${betDetailId} marked as 'failed' due to error.`);
      }

      retryCount++;
      if (retryCount >= maxRetries) {
        console.error("Max retries reached. Aborting processing.");

        // Remove the failed bet from the processing queue
        await removeItem(JSON.stringify(currentBetDetail));
        console.log(`Removed BetDetail with ID ${currentBetDetail._id} from processing queue.`);


        // Mark the parent bet as failed due to a processing issue
        if (currentBetDetail) {
          const parentBet = await Bet.findByIdAndUpdate(currentBetDetail.key, { status: 'failed', isResolved: false });
          const player = await Player.findById(parentBet.player);

          const targetId = player.createdBy as mongoose.Schema.Types.ObjectId;
          const parentBetId = parentBet._id as mongoose.Schema.Types.ObjectId;

          notificationController.createNotification(player._id, targetId, 'error', ` Bet failed during processing : {${currentBetDetail._id}}`, "bet", parentBetId, "refund");

          console.log(`Parent Bet with ID ${currentBetDetail.key} marked as 'failed' due to processing issue.`);
        }
        throw error;
      }
    }
  }
}


function checkIfPlayerWonBet(betDetail, gameData) {

  // check if the game is completed
  if (!gameData.completed) {
    console.log("Game is not yet completed.");
    return "pending";
  }

  // extract the scores from the game data
  const homeTeamScore = gameData.scores.find(team => team.name === gameData.home_team)?.score;
  const awayTeamScore = gameData.scores.find(team => team.name === gameData.away_team)?.score;

  if (homeTeamScore === undefined || awayTeamScore === undefined) {
    console.error("Error: Could not find scores for the teams.");
    return "failed";
  }

  // Check if it's a draw
  if (homeTeamScore === awayTeamScore) {
    console.log("The game ended in a draw.");
    return "draw";
  }

  // Check if the user bet on the home team or away team
  const userBetOn = betDetail.bet_on;

  let userWon = false;

  if (userBetOn === "home_team") {
    // check id the home team won
    userWon = homeTeamScore > awayTeamScore;
  }
  else if (userBetOn === "away_team") {
    // Check if the away team won
    userWon = awayTeamScore > homeTeamScore;
  }

  return userWon ? "won" : "lost";

}

async function awardWinningsToPlayer(playerId, possibleWinningAmount) {
  try {
    // Find the player and update their balance
    const player = await Player.findById(playerId);

    if (!player) {
      console.log(`Player with ID ${playerId} not found.`);
      return;
    }

    // Add the possible winning amount to the player's balance
    player.credits += possibleWinningAmount;

    // Save the updated player data
    await player.save();

    console.log(`Awarded ${possibleWinningAmount} to player with ID ${player._id}`);
  } catch (error) {
    console.error("Error updating player's balance:", error);
  }
}



const processBetsFromQueue = async () => {
  let bets: any[] = [];
  const sports = new Set<string>();

  try {
    const betQueue: any = await getAll();
    const parsedBetQueue = betQueue.map((bet: string) => JSON.parse(bet));

    // Ensure parsedBetQueue is an array
    if (Array.isArray(parsedBetQueue)) {
      // Process each bet item in the parsed queue
      for (const bet of parsedBetQueue) {
        if (bet && bet.sport_key) {
          if (bet.status === "pending") {
            bets.push(bet); // Add to betsData
            sports.add(bet.sport_key); // Add sport_key to the Set
          }
          else {
            // If bet is not pending, remove it from the queue
            console.log(`Removing bet with ID ${bet._id} from the queue as it is not pending (status: ${bet.status})`);
            await removeItem(JSON.stringify(bet));
          }
        }
      }

      const sportKeys = Array.from(sports);
      // console.log(sportKeys, "sports key array");

      // console.log("Bets data after dequeuing:", bets);

      if (bets.length > 0) {
        await processBets(sportKeys, bets); // Process bets if data exists
      } else {
        console.log("Nothing to process in processing queue");
      }
    } else {
      console.log("No bets found in the queue");
    }
  } catch (error) {
    console.error('Error fetching or processing queue data:', error);
  }
};


async function startWorker() {
  console.log("Processing Queue Worker Started")

  let tick = 0

  setInterval(async () => {
    try {
      console.log("Processing Bet.........");
      if (tick === 0) {
        ++tick
        //NOTE: implemented pub sub to tell main thread to broadcast to client for ~live update(60s)
        redisClient.publish('live-update', 'true')

      } else {
        tick = 0
      }

      await processBetsFromQueue();
    } catch (error) {
      console.error("Error in setInterval Waiting Queue Worker:", error);
    }
  }, 30000); // Runs every 30 seconds
}

parentPort.on('message', (message) => {
  if (message === "start") {
    startWorker()
  }
})
