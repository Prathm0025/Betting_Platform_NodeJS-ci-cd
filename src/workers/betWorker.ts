import { parentPort, workerData } from "worker_threads";
import mongoose from "mongoose";
import Store from "../store/storeController";
import Bet, { BetDetail } from "../bets/betModel";
import { dequeue, getAll, size } from "../utils/ProcessingQueue";

async function processBets(sportKeys, bets) {
  console.log("Starting bet processing...");
  console.log("Bets:", bets.length);
  // sportKeys.push(...Array.from(activeRooms));
  console.log(sportKeys, "worker sport key");
  
  try {
    for (const sport of sportKeys) {
      // console.log("Processing sport:", sport);
      const oddsData = await Store.getOdds(sport);
     
      if (!oddsData || !oddsData.completed_games) {
        // console.error(`No data or completed games found for sport: ${sport}`);
        continue; 
      }

      const { completed_games, live_games, upcoming_games } = oddsData;
      
      parentPort.postMessage({
        type: 'updateLiveData',
        livedata: oddsData,
        activeRooms: sportKeys
      });     

      // console.log("Live games:", live_games);
   
      console.log("Upcoming games:", upcoming_games);
      
      for (const game of completed_games) {
        const bet = bets.find((b) => b.event_id === game.id);
        if (bet) {
          await processCompletedBet(bet._id.toString(), game);
          // console.log("Processed bet:", bet._id);
        } else {
          console.log("No bet found for game:", game.id);
        }
      }
    }
  } catch (error) {
    console.error("Error during bet processing:", error);
  }
}

async function processCompletedBet(betDetailId, gameData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const betDetail = await BetDetail.findById(betDetailId).session(session);
    if (!betDetail) {
      console.error("BetDetail not found:", betDetailId);
      await session.abortTransaction();
      return;
    }

    const bet = await Bet.findById(betDetail.key).session(session);
    if (!bet) {
      console.error("Parent Bet not found:", betDetail.key);
      await session.abortTransaction();
      return;
    }

    const winner = determineWinner(
      betDetail,
      gameData,
      bet
    );
    // betDetail.status = winner === betDetail.bet_on ? "won" : "lost";
    await betDetail.save({ session });

    const allBetDetails = await BetDetail.find({ key: bet._id }).session(session);
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
  } finally {
    session.endSession();
  }
}

// function determineWinner(homeTeam, awayTeam, scores) {
//   const homeScore = parseInt(scores.find((s) => s.name === homeTeam)?.score || "0");
//   const awayScore = parseInt(scores.find((s) => s.name === awayTeam)?.score || "0");

//   return homeScore > awayScore ? "home_team" : awayScore > homeScore ? "away_team" : null;
// }

function determineWinner(betDetail, gameData, bet) {
    const betType =bet.market;
    const homeTeamScore = gameData.scores.find(score => score.name === gameData.home_team).score;
    const awayTeamScore = gameData.scores.find(score => score.name === gameData.away_team).score;
    switch(betType) {
        case 'spreads':
            const { handicap, betOn } = betDetail;
            let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
            let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);

            if (betOn === 'A') {
                return adjustedHomeTeamScore > awayTeamScore;
            } else if (betOn === 'B') {
                return adjustedAwayTeamScore > homeTeamScore;
            } else {
                throw new Error("Invalid betOn value for Handicap. It should be 'A' or 'B'.");
            }

        case 'h2h':
            const { betOn:h2hBetOn } = betDetail;
            if (h2hBetOn === 'home_team') {
                return homeTeamScore > awayTeamScore;
            } else if (h2hBetOn === 'away_team') {
                return awayTeamScore > homeTeamScore;
            } else {
                throw new Error("Invalid betOn value for H2H. It should be 'A' or 'B'.");
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
            throw new Error("Invalid betType. It should be 'Handicap', 'H2H', or 'Totals'.");
    }
}

// Example usage for Handicap
// console.log(isBetWinner('Handicap', 2, 1, { handicap: -1.5, betOn: 'A' })); // Output: false

// // Example usage for H2H
// console.log(isBetWinner('H2H', 3, 2, { betOn: 'A' })); // Output: true

// // Example usage for Totals
// console.log(isBetWinner('Totals', 2, 2, { totalLine: 3.5, overUnder: 'Over' })); // Output: true

const fetchAndProcessQueue = async () => {
  console.log("fetching and processing queue");

  let betsData: any[] = [];
  const sports = new Set<string>();

  try {
    const queueSize = await size();

    for (let i = 0; i < queueSize; i++) {
      const bet = await dequeue();
      console.log(bet, "bet");

      if (bet) {
        // Start a Mongoose session for each dequeued bet
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const betDetail = await BetDetail.findById(bet).session(session);
          if (!betDetail) {
            throw new Error("BetDetail not found");
          }

          betsData.push(betDetail);

          // Commit the transaction
          await session.commitTransaction();
        } catch (error) {
          console.error('Error processing bet during transaction:', error);
          await session.abortTransaction();  // Rollback if there's an error
        } finally {
          session.endSession();  // Ensure the session is closed
        }
      }
    }

    betsData.forEach((bet) => sports.add(bet._doc.sport_key));
    const sportKeysArray = Array.from(sports);
    console.log("Bets data after dequeuing:", betsData);
    if (betsData.length > 0) {
      processBets(sportKeysArray, betsData);
    } else {
      console.log("Nothing to process in processing queue");
    }
  } catch (error) {
    console.error('Error fetching or processing queue data:', error);
  }
};

setInterval(()=>{
  fetchAndProcessQueue();
}, 30000)
// The worker receives data from the main thread
// processBets(workerData.sportKeys, workerData.bets)
//   .then(() => {
//     parentPort.postMessage("Bet processing completed.");
//   })
//   .catch((error) => {
//     console.error("Error during worker processing:", error);
//     parentPort.postMessage({ error: error.message });
//   });