import { parentPort, workerData } from "worker_threads";
import mongoose from "mongoose";
import Store from "../store/storeController";
import Bet, { BetDetail } from "../bets/betModel";
import { dequeue, getAll, removeItem, size } from "../utils/ProcessingQueue";
import { config } from "../config/config";
import Player from "../players/playerModel";


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
  console.log("Starting bet processing...");

  try {
    for (const sport of sportKeys) {
      const scoresData = await Store.getScoresForProcessing(sport, "3", "iso");

      if (!scoresData) {
        continue;
      }

      const { completedGames } = scoresData;

      for (const game of completedGames) {

        const betsToBeProcess = bets.filter((b) => b.event_id === game.id);

        if (betsToBeProcess.length > 0) {
          for (const bet of betsToBeProcess) {
            try {
              await processCompletedBet(bet._id.toString(), game);
              await removeItem(JSON.stringify(bet))
            } catch (error) {
              console.log("Error during bet processing:", error);
            }
          }
        }
      }

    }
  } catch (error) {
    console.error("Error during bet processing:", error);
  }
}


async function processCompletedBet(betDetailId, gameData) {
  const maxRetries = 3; // Set the maximum number of retries
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const currentBetDetail = await BetDetail.findById(betDetailId).session(session);
      if (!currentBetDetail) {
        console.error("BetDetail not found:", betDetailId);
        await session.abortTransaction();
        return;
      }

      const parentBet = await Bet.findById(currentBetDetail.key).lean();
      if (!parentBet) {
        console.error("Parent Bet not found:", parentBet);
        await session.abortTransaction();
        return;
      }

      const betDetails = await BetDetail.find({ _id: { $in: parentBet.data } }).lean();

      // Check bet statuses
      let isAnyBetLost = false, isAnyBetPending = false, isAnyBetDraw = false;

      for (const detail of betDetails) {
        if (detail.status === 'lost') {
          isAnyBetLost = true;
          break;
        } else if (detail.status === 'pending') {
          isAnyBetPending = true;
        } else if (detail.status === "draw") {
          isAnyBetDraw = true;
        }
      }

      // If any bet is lost, update the parent Bet and commit transaction
      if (isAnyBetLost) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'lost' }, { session });
        console.log(`Parent Bet with ID ${parentBet._id} updated to 'lost'`);
        await session.commitTransaction();
        return;
      }

      // Process the current bet result
      const result = checkIfPlayerWonBet(currentBetDetail, gameData);
      if (["won", "lost", "draw"].includes(result)) {
        await BetDetail.findByIdAndUpdate(currentBetDetail._id, { status: result }, { session });
        console.log(`BetDetail with ID ${currentBetDetail._id} updated to '${result}'`);
      }

      // Check if all bets are won or all bets are a draw
      const updatedBetDetails = await BetDetail.find({ _id: { $in: parentBet.data } }).lean();
      const allBetsWon = updatedBetDetails.every(detail => detail.status === 'won');
      const allBetsDraw = updatedBetDetails.every(detail => detail.status === 'draw');

      // Update parent Bet's status based on child BetDetails
      if (allBetsWon) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'won' }, { session });
        await awardWinningsToPlayer(parentBet.player, parentBet.possibleWinningAmount);
        console.log(`Parent Bet with ID ${parentBet._id} won and winnings awarded.`);
      } else if (allBetsDraw) {
        await Bet.findByIdAndUpdate(parentBet._id, { status: 'draw' }, { session });
        console.log(`Parent Bet with ID ${parentBet._id} updated to 'draw'`);
      }

      await session.commitTransaction();
      break; // Exit retry loop on success

    } catch (error) {
      console.error("Error during transaction, retrying...", error);

      // Retry only on specific transient errors like WriteConflict
      if (error.codeName === "WriteConflict" || error.errorLabels?.includes("TransientTransactionError")) {
        retryCount++;
        if (retryCount >= maxRetries) {
          console.error("Max retries reached. Aborting transaction.");
          await session.abortTransaction();
          throw error;
        }
        await session.abortTransaction();
      } else {
        // For other errors, don't retry, just abort the transaction
        await session.abortTransaction();
        throw error;
      }
    } finally {
      session.endSession();
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
    return "error";
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
  let betsData: any[] = [];
  const sports = new Set<string>();

  try {
    const betQueue: any = await getAll();
    console.log(betQueue, "betqueue");

    // Parse the stringified betQueue data
    const parsedBetQueue = betQueue.map((bet: string) => JSON.parse(bet));

    // Ensure parsedBetQueue is an array
    if (Array.isArray(parsedBetQueue)) {
      // Process each bet item in the parsed queue
      parsedBetQueue.forEach((bet) => {
        // Ensure bet is an object and has sport_key
        if (bet && bet.sport_key) {
          betsData.push(bet); // Add to betsData
          sports.add(bet.sport_key); // Add sport_key to the Set
        }
      });

      const sportKeysArray = Array.from(sports);
      console.log(sportKeysArray, "sports key array");

      console.log("Bets data after dequeuing:", betsData);

      if (betsData.length > 0) {
        await processBets(sportKeysArray, betsData); // Process bets if data exists
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
  setInterval(async () => {
    try {
      console.log("Processing Bet.........");
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
