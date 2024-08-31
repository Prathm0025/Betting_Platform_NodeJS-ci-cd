import { parentPort, workerData } from "worker_threads";
import mongoose from "mongoose";
import Store from "../store/storeController";
import Bet, { BetDetail } from "./betModel";

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
      betDetail.home_team.name,
      betDetail.away_team.name,
      gameData.scores
    );
    betDetail.status = winner === betDetail.bet_on ? "won" : "lost";
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

function determineWinner(homeTeam, awayTeam, scores) {
  const homeScore = parseInt(scores.find((s) => s.name === homeTeam)?.score || "0");
  const awayScore = parseInt(scores.find((s) => s.name === awayTeam)?.score || "0");

  return homeScore > awayScore ? "home_team" : awayScore > homeScore ? "away_team" : null;
}

// The worker receives data from the main thread
processBets(workerData.sportKeys, workerData.bets)
  .then(() => {
    parentPort.postMessage("Bet processing completed.");
  })
  .catch((error) => {
    console.error("Error during worker processing:", error);
    parentPort.postMessage({ error: error.message });
  });