import { parentPort, workerData } from "worker_threads";
import mongoose from "mongoose";
import Store from "../store/storeController";
import Bet, { BetDetail } from "../bets/betModel";
import { dequeue, getAll, removeItem, size } from "../utils/ProcessingQueue";
import { connect } from "http2";
import { config } from "../config/config";
import Player from "../players/playerModel";

async  function connectDB (){
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
  console.log("Bets:", bets.length);
  // sportKeys.push(...Array.from(activeRooms));
  console.log(sportKeys, "worker sport key");

  try {
    for (const sport of sportKeys) {
      // console.log("Processing sport:", sport);
      const oddsData = await Store.getOdds(sport);
      // console.log(oddsData, "odds data of bets");

      if (!oddsData || !oddsData.completed_games) {
        // console.error(`No data or completed games found for sport: ${sport}`);
        continue;
      }

      const { completed_games, live_games, future_upcoming_games } = oddsData;

      // parentPort.postMessage({
      //   type: 'updateLiveData',
      //   livedata: oddsData,
      //   activeRooms: sportKeys
      // });     

      // console.log("Live games:", live_games);

      // console.log("Upcoming games:", upcoming_games);

      for (const game of future_upcoming_games) {

        const bet = bets.find((b) => b.event_id === game.id);
        
        if (bet) {

          await processCompletedBet(bet._id.toString(), game);
          removeItem(bets[0]);
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
   console.log(betDetail, "bet detail");
   
    const bet = await Bet.findById(betDetail.key).session(session);
    if (!bet) {
      console.error("Parent Bet not found:", betDetail.key);
      await session.abortTransaction();
      return;
    }

    const winner =await processBetResult(
      betDetail,
      gameData,
      bet
    );
  // if(winner){
    betDetail.status = "won"

  // }
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
  console.log(bet, "bet");
  
    const betType =betDetail.market;
    console.log(betType, "betType");
    
    const homeTeamScore = gameData.scores.find(score => score.name === gameData.home_team).score;
    const awayTeamScore = gameData.scores.find(score => score.name === gameData.away_team).score;
    switch(betType) {
        case 'spreads':
            const { handicap, bet_on:betOn } = betDetail;
            let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
            let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);

            if (betOn === 'home_team') {
                return adjustedHomeTeamScore > awayTeamScore;
            } else if (betOn === 'away_team') {
                return adjustedAwayTeamScore > homeTeamScore;
            } else {
                throw new Error("Invalid betOn value for Handicap. It should be 'A' or 'B'.");
            }

        case 'h2h':
            const { bet_on:h2hBetOn } = betDetail;
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


function calculateWinningAmount(stake, odds, oddsType) {
  let winningAmount;

  if (oddsType === 'american') {
      if (odds > 0) {
          // Positive American odds
          winningAmount = stake * (odds / 100);
      } else if (odds < 0) {
          // Negative American odds
          winningAmount = stake / (Math.abs(odds) / 100);
      } else {
          // Invalid American odds
          return stake;
      }
  } else if (oddsType === 'decimal') {
      if (odds <= 1) {
          // Decimal odds of 1 or less indicate no profit
          return stake; // You only get your stake back
      }

      // Total payout for decimal odds
      winningAmount = stake * odds - stake;
  } else {
      throw new Error('Invalid odds type provided. Use "american" or "decimal".');
  }

  // Return the total payout which is the winning amount plus the original stake
  return winningAmount + stake;
}

async function processBetResult(betDetail, gameData, bet) {
  const isWinner = determineWinner(betDetail, gameData, bet);

  if (isWinner) {
    console.log(gameData.markets, "market");
    
    const market = gameData.markets.find((m) => m.key === bet.market)
      // Find the outcome for the specified team
      const teamname = betDetail.bet_on===  "home_team"? betDetail.home_team.name:betDetail.away_team.name;
      console.log(teamname, "teamname");
      
      // const outcome = market?.outcomes?.find((o) => o.name === teamname )||[];
      // console.log(outcome, "outcome");
      
      const  odds = 2.5
      const winnings = calculateWinningAmount(bet.amount, odds, betDetail.oddsFormat);
      console.log(`Bet won! Winning amount: ${winnings}`);  
      const playerId = bet.player;
      const player:any = await Player.findById(playerId);
       
      if (!player) {
        console.log('Player not found.');
        return;
      }
        player.credits = (player.credits || 0) + winnings;
  
      await player.save();
      console.log(`Player's credit updated. New credit: ${player.credits}`);
  

  } else {
      console.log('Bet lost. No winnings.');
      return 0; // No winnings if the bet is lost
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

const fetchAndProcessQueue = async () => {
  console.log("fetching and processing queue");

  let betsData: any[] = [];
  const sports = new Set<string>();

  try {
    const betQueue: any = await getAll(); // Fetch from Redis or Queue
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
        console.log(betsData, "BET DATA");
        
        processBets(sportKeysArray, betsData); // Process bets if data exists
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
