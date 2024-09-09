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
      console.log(scoresData, "score data");

      if (!scoresData) {
        continue;
      }
      const { completedGames } = scoresData;
      //  const oddsData = await Store.getOddsForProcessing(sport)

      for (const game of completedGames) {
        // CHANGE THIS TO COMPLETD BETS (if not)
        const betsToBeProcess = bets.filter((b) => b.event_id === game.id);

        if (betsToBeProcess.length > 0) {
          for (const bet of betsToBeProcess) {
            if (bet) {
              try {
                const removalResult = await removeItem(JSON.stringify(bet));
                if (removalResult === 0) {
                  console.log(
                    `Bet ${bet._id} could not be removed from the queue.`
                  );
                } else {
                  console.log(
                    `Bet ${bet._id} removed successfully from the queue.`
                  );
                }
                await processCompletedBet(bet._id.toString(), game);
              } catch (error) {
                console.log(error);
              }
            } else {
              console.log("No bet found for game:", game.id);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error during bet processing:", error);
  }
}

// THIS WILL BE CALLED ONLY WHEN MATCH IS COMPLETED
async function processCompletedBet(betDetailId, gameData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const betDetail = await BetDetail.findById(betDetailId).session(session);
    if (!betDetail) {
      console.error("Bet Detail not found:", betDetailId);
      await session.abortTransaction();
      return;
    }

    const parentBetId = betDetail.key;
    const bet = await Bet.findById(parentBetId)
      .populate("data")
      .session(session);

    if (!bet) {
      console.error("Parent Bet not found:", parentBetId);
      await session.abortTransaction();
      return;
    }

    // for combo bets
    if (bet.betType === "combo") {
      const allBetDetailsValid = bet.data.every(
        (detail: any) => detail.status === "won" || detail.status === "pending"
      );
      // if any one bet detail is failed under an parent  bet we mark all bet as failed
      if (!allBetDetailsValid) {
        betDetail.isResolved = true;
        await betDetail.save({ session });
        //NOTIFY AGENT HERE
        // bet.status = 'failed';
        // await bet.save({ session }); // Mark parent bet as failed
        await session.commitTransaction();
        return;
      }
    }

    // Await result of processing bet
    await processBetResult(betDetail, gameData, bet);

    if (processBetResult) {
      betDetail.status = "won";
      await betDetail.save({ session });
    } else {
      betDetail.status = "lost";
      await betDetail.save({ session });
    }

    const allBetDetails = await BetDetail.find({ key: bet._id }).session(
      session
    );
    const allProcessed = allBetDetails.every(
      (detail) => detail.status !== "pending"
    );

    if (allProcessed) {
      bet.status = allBetDetails.every((detail) => detail.status === "won")
        ? "won"
        : "lost";
      await bet.save({ session });
    }

    await session.commitTransaction();
  } catch (error) {
    console.error("Error processing completed bet:", error);
    await session.abortTransaction();
    try {
      const betDetail = await BetDetail.findById(betDetailId);
      if (betDetail) {
        betDetail.isResolved = true;
        await betDetail.save();
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
  } finally {
    session.endSession();
  }
}

function determineWinner(betDetail, gameData, bet) {
  try {
    const betType = betDetail.market;
    console.log(betType, "betType");
    // console.log(gameData, "");
    if (gameData.scores === null) {
      throw new Error("No Scores from the API");
    }
    const homeTeamScore = gameData?.scores?.find(
      (score) => score.name === gameData.home_team
    ).score;
    const awayTeamScore = gameData?.scores?.find(
      (score) => score.name === gameData.away_team
    ).score;

    switch (betType) {
      // case 'spreads':
      //   const { handicap, bet_on: betOn } = betDetail;
      //   let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
      //   let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);

      //   if (betOn === 'home_team') {
      //     return adjustedHomeTeamScore > awayTeamScore;
      //   } else if (betOn === 'away_team') {
      //     return adjustedAwayTeamScore > homeTeamScore;
      //   } else {
      //     throw new Error("Invalid betOn value for Handicap. It should be home_team or away_team.");
      //   }

      case "h2h":
        const { bet_on: h2hBetOn } = betDetail;
        if (h2hBetOn === "home_team") {
          return homeTeamScore > awayTeamScore;
        } else if (h2hBetOn === "away_team") {
          return awayTeamScore > homeTeamScore;
        } else {
          throw new Error(
            "Invalid betOn value for H2H. It should be 'home_team' or 'away_team'."
          );
        }
      // case 'totals':
      //     const { totalLine, overUnder } = options;
      //     let totalScore = teamAScore + teamBScore;

      //     if (overUnder === 'Over') {
      //         return totalScore > totalLine;
      //     } else if (overUnder === 'Under') {
      //         return totalScore < totalLine;
      //     } else {
      //         throw new Error("Invalid overUnder value for Totals. It should be 'Over' or 'Under'.");
      //     }
      default:
        throw new Error("Invalid betType. It should be 'spreads' or 'h2h'.");
    }
  } catch (error) {
    console.error("Error determining winner:", error.message);
    throw new Error("An Error occured, maybe no scores");
  }
}

function calculateWinningAmount(stake, odds, oddsType) {
  let winningAmount;

  if (oddsType === "american") {
    if (odds > 0) {
      winningAmount = stake * (odds / 100);
    } else if (odds < 0) {
      winningAmount = stake / (Math.abs(odds) / 100);
    } else {
      return stake;
    }
  } else if (oddsType === "decimal") {
    if (odds <= 1) {
      return stake;
    }

    winningAmount = stake * odds - stake;
  } else {
    throw new Error('Invalid odds type provided. Use "american" or "decimal".');
  }
  return winningAmount + stake;
}

async function processBetResult(betDetail, gameData, bet) {
  const isWinner = determineWinner(betDetail, gameData, bet);
  if (!isWinner) {
    return false;
  }
  if (isWinner) {
    console.log(gameData.markets, "market");

    const teamname =
      betDetail.bet_on === "home_team"
        ? betDetail.home_team.name
        : betDetail.away_team.name;
    console.log(teamname, "teamname");
    const type = bet.type;
    const allBetDetailsValid = bet.data.every(
      (betDetail: any) =>
        betDetail.status === "won" || betDetail.status === "pending"
    );

    if (type === "combo" && !allBetDetailsValid) {
      return false;
    }
    const odds =
      betDetail.bet_on === "home_team"
        ? betDetail.home_team.odds
        : betDetail.away_team.odds;
    const winnings = calculateWinningAmount(
      bet.amount,
      odds,
      betDetail.oddsFormat
    );
    console.log(`Bet won! Winning amount: ${winnings}`);

    const playerId = bet.player;
    const player: any = await Player.findById(playerId);

    if (!player) {
      console.log("Player not found.");
      return;
    }
    player.credits = (player.credits || 0) + winnings;

    await player.save();
    console.log(`Player's credit updated. New credit: ${player.credits}`);
  }
}

// Example usage:
// const stake = 100; // Amount you want to bet
// const americanOdds = -150; // American odds
// const decimalOdds = 2.50; // Decimal odds

// // Calculate for American odds
// const payoutAmerican = calculateWinningAmount(stake, americanOdds, 'american');
// console.log(`Total Payout for American Odds: $${payoutAmerican.toFixed(2)}`);

// // Calculate for Decimal odds
// const payoutDecimal = calculateWinningAmount(stake, decimalOdds, 'decimal');
// console.log(`Total Payout for Decimal Odds: $${payoutDecimal.toFixed(2)}`);

// Example usage for Handicap
// console.log(isBetWinner('Handicap', 2, 1, { handicap: -1.5, betOn: 'A' })); // Output: false

// // Example usage for H2H
// console.log(isBetWinner('H2H', 3, 2, { betOn: 'A' })); // Output: true

// // Example usage for Totals
// console.log(isBetWinner('Totals', 2, 2, { totalLine: 3.5, overUnder: 'Over' })); // Output: true

const processBetsFromQueue = async () => {
  let betsData: any[] = [];
  const sports = new Set<string>();

  try {
    const betQueue: any = await getAll();
    console.log(betQueue, "betqueue");

    const parsedBetQueue = betQueue.map((bet: string) => JSON.parse(bet));

    if (Array.isArray(parsedBetQueue)) {
      parsedBetQueue.forEach((bet) => {
        if (bet && bet.sport_key) {
          betsData.push(bet);
          sports.add(bet.sport_key);
        }
      });
      const sportKeysArray = Array.from(sports);
      console.log(sportKeysArray, "sports key array");

      console.log("Bets data after dequeuing:", betsData);

      if (betsData.length > 0) {
        processBets(sportKeysArray, betsData);
      } else {
        console.log("Nothing to process in processing queue");
      }
    } else {
      console.log("No bets found in the queue");
    }
  } catch (error) {
    console.error("Error fetching or processing queue data:", error);
  }
};

async function startWorker() {
  console.log("Processing Queue Worker Started");
  setInterval(async () => {
    try {
      console.log("Processing Bet.........");
      await processBetsFromQueue();
    } catch (error) {
      console.error("Error in setInterval Waiting Queue Worker:", error);
    }
  }, 30000);
}

parentPort.on("message", (message) => {
  if (message === "start") {
    startWorker();
  }
});
