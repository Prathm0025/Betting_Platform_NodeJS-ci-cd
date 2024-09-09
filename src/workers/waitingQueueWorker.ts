import { redisClient } from '../redisclient';
import mongoose from 'mongoose';
import Bet, { BetDetail } from '../bets/betModel';
import { config } from '../config/config';
import { parentPort } from 'worker_threads';

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

export async function checkBetsCommenceTime() {
  const now = new Date().getTime();
  const bets = await redisClient.zrangebyscore('waitingQueue', 0, now);

  for (const bet of bets) {
    const data = JSON.parse(bet);

    const commenceTime = data.commence_time;
    const betId = data.betId;

    if (now >= new Date(commenceTime).getTime()) {
      try {

        const betDetail = await BetDetail.findById(betId).lean();
        const betParent = await Bet.findById(betDetail.key).lean();

        if (!betDetail || !betParent) {
          console.log(`BetDetail or BetParent not found for betId: ${betId}, removing from queue`);

          // Remove the problematic bet from the waiting queue
          await redisClient.zrem('waitingQueue', bet);
          continue; // Skip further processing for this bet
        }

        const multi = redisClient.multi();

        // Add the entire betDetail data to the processing queue
        multi.lpush('processingQueue', JSON.stringify(betDetail));

        // Remove the bet from the waiting queue
        multi.zrem('waitingQueue', bet)

        await multi.exec();

      } catch (error) {
        console.log(`Error processing bet with ID ${betId}:`, error);

        // Remove the problematic bet from the waiting queue if an error occurs
        await redisClient.zrem('waitingQueue', bet);
      }

    }
  }
}




async function startWorker() {
  console.log("Waiting Queue Worker Started")
  setInterval(async () => {
    try {
      console.log("Checking bets commence time...");

      await checkBetsCommenceTime();
      // const bets = await getAllBetsForPlayer('66dc523111f2ab2408f0041b')
      // console.log("PLAYER BETS ; ", JSON.stringify(bets));

    } catch (error) {
      console.error("Error in setInterval Waiting Queue Worker:", error);
    }
  }, 30000); // Runs every 30 seconds
}


// async function getAllBetsForPlayer(playerId) {
//   try {
//     // Ensure the provided playerId is a valid MongoDB ObjectId
//     if (!mongoose.Types.ObjectId.isValid(playerId)) {
//       throw new Error('Invalid player ID');
//     }

//     // Find all bets for the given playerId and populate the BetDetail data
//     const bets = await Bet.find({ player: playerId })
//       .populate({
//         path: 'data', // Populate the 'data' field referencing BetDetail
//         model: 'BetDetail',
//       })
//       .lean(); // Use lean() for performance boost

//     if (!bets || bets.length === 0) {
//       console.log(`No bets found for player with ID: ${playerId}`);
//       return [];
//     }

//     return bets;
//   } catch (error) {
//     console.error(`Error retrieving bets for player with ID ${playerId}:`, error);
//     throw error; // Rethrow the error to handle it in the calling function
//   }
// }

// const bets = [
//   {
//     "_id": "66dc531911f2ab2408f004b4",
//     "key": "66dc531911f2ab2408f004b3",
//     "event_id": "a0767dfb37ccd787c871fb1b36644f1f",
//     "sport_title": "CFL",
//     "sport_key": "americanfootball_cfl",
//     "commence_time": "2024-09-07T17:00:00.000Z",
//     "home_team": {
//       "name": "Ottawa Redblacks",
//       "odds": 1.95
//     },
//     "away_team": {
//       "name": "Toronto Argonauts",
//       "odds": 1.87
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betmgm",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc531a11f2ab2408f004cc",
//     "key": "66dc531a11f2ab2408f004cb",
//     "event_id": "285e3c1becc46c8d6db423eecd866899",
//     "sport_title": "CFL",
//     "sport_key": "americanfootball_cfl",
//     "commence_time": "2024-09-07T19:00:00.000Z",
//     "home_team": {
//       "name": "Winnipeg Blue Bombers",
//       "odds": 1.69
//     },
//     "away_team": {
//       "name": "Saskatchewan Roughriders",
//       "odds": 2.2
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betmgm",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc531b11f2ab2408f004e0",
//     "key": "66dc531b11f2ab2408f004df",
//     "event_id": "628ab290a854f515bfe6f87c0b4e9265",
//     "sport_title": "CFL",
//     "sport_key": "americanfootball_cfl",
//     "commence_time": "2024-09-07T23:00:00.000Z",
//     "home_team": {
//       "name": "Edmonton Elks",
//       "odds": 1.54
//     },
//     "away_team": {
//       "name": "Calgary Stampeders",
//       "odds": 2.5
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc534211f2ab2408f004f8",
//     "key": "66dc534211f2ab2408f004f7",
//     "event_id": "65f96a1f620c313ea996870b1441db94",
//     "sport_title": "CFL",
//     "sport_key": "americanfootball_cfl",
//     "commence_time": "2024-09-14T19:00:00.000Z",
//     "home_team": {
//       "name": "Hamilton Tiger-Cats",
//       "odds": 2.8
//     },
//     "away_team": {
//       "name": "Ottawa Redblacks",
//       "odds": 1.44
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "fanduel",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc535011f2ab2408f00505",
//     "key": "66dc535011f2ab2408f00504",
//     "event_id": "8b5b1b4d5d915fbf8c88f6b8d0cc0204",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Rutgers Scarlet Knights",
//       "odds": 1.02
//     },
//     "away_team": {
//       "name": "Akron Zips",
//       "odds": 15
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc535011f2ab2408f00507",
//     "key": "66dc535011f2ab2408f00504",
//     "event_id": "fa1859a14a67bde250d18569371d0a19",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Oklahoma State Cowboys",
//       "odds": 1.25
//     },
//     "away_team": {
//       "name": "Arkansas Razorbacks",
//       "odds": 3.95
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc536011f2ab2408f00513",
//     "key": "66dc536011f2ab2408f00512",
//     "event_id": "6e9bbbabe9ae5b585e6dc087342d73ca",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Florida Atlantic Owls",
//       "odds": 1.7
//     },
//     "away_team": {
//       "name": "Army Black Knights",
//       "odds": 2.18
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc536111f2ab2408f0051f",
//     "key": "66dc536111f2ab2408f0051e",
//     "event_id": "881fce0b9a79055748756d237e12485b",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Syracuse Orange",
//       "odds": 2.3
//     },
//     "away_team": {
//       "name": "Georgia Tech Yellow Jackets",
//       "odds": 1.62
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betmgm",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc536111f2ab2408f0052b",
//     "key": "66dc536111f2ab2408f0052a",
//     "event_id": "0540b3e034dd80286051cf9d535554ec",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Tulane Green Wave",
//       "odds": 3.65
//     },
//     "away_team": {
//       "name": "Kansas State Wildcats",
//       "odds": 1.29
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc536211f2ab2408f00537",
//     "key": "66dc536211f2ab2408f00536",
//     "event_id": "8e3045f419101edb642054549768ac67",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Michigan Wolverines",
//       "odds": 3.15
//     },
//     "away_team": {
//       "name": "Texas Longhorns",
//       "odds": 1.36
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc536211f2ab2408f00543",
//     "key": "66dc536211f2ab2408f00542",
//     "event_id": "fbcd3511d7e2f0da0d3089214d23e7e5",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T16:00:00.000Z",
//     "home_team": {
//       "name": "Minnesota Golden Gophers",
//       "odds": 1.06
//     },
//     "away_team": {
//       "name": "Rhode Island Rams",
//       "odds": 9
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc537011f2ab2408f00552",
//     "key": "66dc537011f2ab2408f00551",
//     "event_id": "39645286b873cd6d92106d2766b91b82",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T19:30:00.000Z",
//     "home_team": {
//       "name": "Auburn Tigers",
//       "odds": 1.21
//     },
//     "away_team": {
//       "name": "California Golden Bears",
//       "odds": 4.5
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "bovada",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc537011f2ab2408f00554",
//     "key": "66dc537011f2ab2408f00551",
//     "event_id": "621e5bd1dbcee75ac410925248d52477",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T19:30:00.000Z",
//     "home_team": {
//       "name": "Utah Utes",
//       "odds": 1.12
//     },
//     "away_team": {
//       "name": "Baylor Bears",
//       "odds": 6.25
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "bovada",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc537011f2ab2408f00556",
//     "key": "66dc537011f2ab2408f00551",
//     "event_id": "2f856f64f32add975208b5cc7ca48245",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T19:30:00.000Z",
//     "home_team": {
//       "name": "Iowa Hawkeyes",
//       "odds": 1.68
//     },
//     "away_team": {
//       "name": "Iowa State Cyclones",
//       "odds": 2.2
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc537011f2ab2408f00558",
//     "key": "66dc537011f2ab2408f00551",
//     "event_id": "186fc1909f59fc9c4b205e03d8cc6381",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T19:30:00.000Z",
//     "home_team": {
//       "name": "Wyoming Cowboys",
//       "odds": 1.3
//     },
//     "away_team": {
//       "name": "Idaho Vandals",
//       "odds": 3.4
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "betrivers",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   },
//   {
//     "_id": "66dc538411f2ab2408f00564",
//     "key": "66dc538411f2ab2408f00563",
//     "event_id": "ac40d4dd3d6f472769ce1a6136cbacc9",
//     "sport_title": "NCAAF",
//     "sport_key": "americanfootball_ncaaf",
//     "commence_time": "2024-09-07T19:30:00.000Z",
//     "home_team": {
//       "name": "North Carolina Tar Heels",
//       "odds": 1.05
//     },
//     "away_team": {
//       "name": "Charlotte 49ers",
//       "odds": 10.5
//     },
//     "market": "h2h",
//     "bet_on": "home_team",
//     "selected": "bovada",
//     "oddsFormat": "decimal",
//     "status": "pending",
//     "__v": 0
//   }
// ]

// async function addMultipleBetsToProcessingQueue(bets) {
//   try {
//     // Start a Redis multi transaction to push multiple bets at once
//     const multi = redisClient.multi();

//     // Loop through each bet and add to Redis multi command
//     for (const bet of bets) {
//       // Serialize each bet object to a JSON string
//       const serializedBet = JSON.stringify(bet);
//       // Add the serialized bet to the processingQueue
//       multi.lpush('processingQueue', serializedBet);
//     }

//     // Execute all commands in the multi queue
//     await multi.exec();

//     console.log(`${bets.length} bets added to processingQueue`);
//   } catch (error) {
//     console.error("Error adding bets to processing queue:", error);
//   }
// }
parentPort.on('message', (message) => {
  if (message === "start") {
    startWorker();
  }
})