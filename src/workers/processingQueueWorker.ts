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
  console.log("Bets:", bets.length);

  try {
    for (const sport of sportKeys) {
      const scoresData = await Store.getScoresForProcessing(sport, "3", "iso");
    console.log(scoresData, "score data");
    
      if (!scoresData ) {
        continue;
      }
      const {futureUpcomingGames, completedGames} =scoresData;
    //  const oddsData = await Store.getOddsForProcessing(sport)
    //  console.log(oddsData, "odds Data");
     
      // const { completed_games, live_games, future_upcoming_games,todays_upcoming_games } = oddsData;
      // const allGames = [
      //   ...completed_games,
      //   ...live_games,
      //   ...future_upcoming_games,
      //   ...todays_upcoming_games
      // ];
      

      for (const game of completedGames) {
        
        const bet = bets.find((b) => b.event_id === game.id );
        
        if (bet) {
          try {
            await processCompletedBet(bet._id.toString(), game);
            // for(const processedBets of bets ){
             
          // }
          } catch (error) {
            
          }
        } else {
          console.log("No bet found for game:", game.id);
        }
        const removalResult = await removeItem(JSON.stringify(bet));
        if (removalResult === 0) {
          console.log(`Bet ${bet._id} could not be removed from the queue.`);
        } else {
          console.log(`Bet ${bet._id} removed successfully from the queue.`);
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

    const parentBetId = betDetail.key;
    const bet = await Bet.findById(parentBetId)
      .populate('data')
      .session(session);

    if (!bet) {
      console.error("Parent Bet not found:", parentBetId);
      await session.abortTransaction();
      return;
    }

    const allBetDetailsValid = bet.data.every(
      (detail: any) => detail.status === 'won' || detail.status === 'pending'
    );

    if (!allBetDetailsValid) {
      // Mark all invalid bet details as failed
      await Promise.all(
        bet.data.map(async (detail: any) => {
          if (detail.status !== 'won' && detail.status !== 'pending') {
            detail.status = 'failed';
            await detail.save({ session });
          }
        })
      );

      // Mark the parent bet as failed
      bet.status = 'failed';
      await bet.save({ session });
      await session.commitTransaction();
      return;
    }

    // Mark parent bet as won
    bet.status = "won";
    await bet.save({ session });

    // Await result of processing bet
    const winner = await processBetResult(betDetail, gameData, bet);

    betDetail.status = "won";
    await betDetail.save({ session });

    const allBetDetails = await BetDetail.find({ key: bet._id }).session(session);
    const allProcessed = allBetDetails.every(detail => detail.status !== "pending");

    if (allProcessed) {
      bet.status = allBetDetails.every(detail => detail.status === "won") ? "won" : "lost";
      await bet.save({ session });
    }

    // Commit the transaction
    await session.commitTransaction();
  } catch (error) {
    console.error("Error processing completed bet:", error);

    // Abort the transaction first
    await session.abortTransaction();

    try {
      // Update BetDetail, Bet, and Player outside the session after the transaction is aborted
      const betDetail = await BetDetail.findById(betDetailId);
      if (betDetail) {
        betDetail.status = "failed";
        await betDetail.save();
      }

      const bet = await Bet.findById(betDetail.key);
      if (bet) {
        const betAmount = bet.amount;
        bet.status = "failed";
        await bet.save();

        const player = await Player.findById(bet.player);
        if (player) {
          // Refund player's credits after failed bet
          player.credits += betAmount;
          await player.save();
          console.log(`Refunded ${betAmount} to player ${player._id} due to failure.`);
        }
      }
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
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
  try {
    console.log(bet, "bet");

    const betType = betDetail.market;
    console.log(betType, "betType");
    console.log(gameData, "");
    
    const homeTeamScore = gameData.scores.find(score => score.name === gameData.home_team).score;
    const awayTeamScore = gameData.scores.find(score => score.name === gameData.away_team).score;

    switch (betType) {
      case 'spreads':
        const { handicap, bet_on: betOn } = betDetail;
        let adjustedHomeTeamScore = homeTeamScore + (betOn === 'home_team' ? handicap : 0);
        let adjustedAwayTeamScore = awayTeamScore + (betOn === 'away_team' ? handicap : 0);

        if (betOn === 'home_team') {
          return adjustedHomeTeamScore > awayTeamScore;
        } else if (betOn === 'away_team') {
          return adjustedAwayTeamScore > homeTeamScore;
        } else {
          throw new Error("Invalid betOn value for Handicap. It should be home_team or away_team.");
        }

      case 'h2h':
        const { bet_on: h2hBetOn } = betDetail;
        if (h2hBetOn === 'home_team') {
          return homeTeamScore > awayTeamScore;
        } else if (h2hBetOn === 'away_team') {
          return awayTeamScore > homeTeamScore;
        } else {
          throw new Error("Invalid betOn value for H2H. It should be 'home_team' or 'away_team'.");
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
    throw new Error("An Error occured, maybe no scores")
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
    const teamname = betDetail.bet_on === "home_team" ? betDetail.home_team.name : betDetail.away_team.name;
    console.log(teamname, "teamname");
    const type = bet.type;
    const allBetDetailsValid = bet.data.every(
      (betDetail: any) => betDetail.status === 'won' || betDetail.status === 'pending'
    );

    if(type==="combo" && !allBetDetailsValid){
      return;
    }
    // const outcome = market?.outcomes?.find((o) => o.name === teamname )||[];
    // console.log(outcome, "outcome");

    const odds = betDetail.bet_on === "home_team" ? betDetail.home_team.odds : betDetail.away_team.odds;
    const winnings = calculateWinningAmount(bet.amount, odds, betDetail.oddsFormat);
    console.log(`Bet won! Winning amount: ${winnings}`);

    const playerId = bet.player;
    const player: any = await Player.findById(playerId);

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
