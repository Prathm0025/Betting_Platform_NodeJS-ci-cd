import { log } from "console";
import Player from "../players/playerModel";
import DailyActivity, { Activity } from "./userActivityModel"
import createHttpError from "http-errors";
import { NextFunction, Request, Response } from "express";
import Bet from "../bets/betModel";
import Transaction from "../transactions/transactionModel";

class UserActivityController {

  async createActiviySession(username: string, startTime: Date) {
    try {
      const player = await Player.findOne({ username: username });
      if (!player) {
        throw createHttpError(404, "Player Not Found")
      }

      const newActivitySession = new Activity(
        {
          startTime
        }
      )
      const savedNewActivitySession = await newActivitySession.save();
      const today = new Date();
      today.setHours(0, 0, 0, 0)
      let dailyActivity;
      dailyActivity = await DailyActivity.findOne({
        player: player._id,
        date: today,
      });

      if (!dailyActivity) {
        dailyActivity = new DailyActivity({
          date: today,
          player: player._id,
        })
        await dailyActivity.save();
      }
      const updateDailyActivity = await DailyActivity.findByIdAndUpdate(dailyActivity._id, {
        $push: { actvity: savedNewActivitySession._id },
      },
        { new: true, useFindAndModify: false }
      )
      console.log(savedNewActivitySession, dailyActivity);

    } catch (error) {
      console.error("Error creating activity:", error.message);
    }
  }

  async endSession(username: string, endTime: Date) {
    try {
      const player = await Player.findOne({ username: username });
      if (!player) {
        throw createHttpError(404, "Player Not Found");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyActivity = await DailyActivity.findOne({
        date: today,
        player: player._id
      }).populate('actvity');

      if (!dailyActivity || !dailyActivity.actvity) {
        throw createHttpError(404, "No activity found for today.");
      }

      const latestActivitySession: any = dailyActivity.actvity.find((activity: any) => activity.endTime === null);

      if (!latestActivitySession) {
        throw createHttpError(404, "No active session to end.");
      }
      latestActivitySession.endTime = endTime;

      await latestActivitySession.save();

      return { message: "Session ended successfully", endTime };
    } catch (error) {
      throw error;
    }
  }

  async getBetsAndTransactionsInActivitySession(req:Request, res:Response , next:NextFunction) {
    try{
    const {startTime, endTime} = req.body;
    const betsAggregation = Bet.aggregate([
      {
        $match: {
          createdAt: { $gte: startTime, $lte: endTime },
        },
      },
      {
        $lookup: {
          from: 'players',
          localField: 'player',
          foreignField: '_id',
          as: 'playerDetails',
        },
      },
      {
        $unwind: '$playerDetails',
      },
      {
        $lookup: {
          from: 'betdetails',
          localField: 'data',
          foreignField: '_id',
          as: 'betDetails',
        },
      },
      {
        $project: {
          'playerDetails.username': 1,
          'betDetails.commence_time': 1,
          'betDetails.home_team.name': 1,
          'betDetails.away_team.name': 1,
          amount: 1,
          status: 1,
        },
      },
    ]);

    const transactionsAggregation = Transaction.aggregate([
      {
        $match: {
          date: { $gte: startTime, $lte: endTime },
        },
      },
      {
        $lookup: {
          from: 'players',
          localField: 'sender',
          foreignField: '_id',
          as: 'senderDetails',
        },
      },
      {
        $lookup: {
          from: 'players',
          localField: 'receiver',
          foreignField: '_id',
          as: 'receiverDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'sender',
          foreignField: '_id',
          as: 'senderDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'receiver',
          foreignField: '_id',
          as: 'receiverDetails',
        },
      },
      {
        $unwind: {
          path: '$senderDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: '$receiverDetails',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          'senderDetails.username': 1,
          'receiverDetails.username': 1,
          amount: 1,
          type: 1,
          date: 1,
        },
      },
    ]);

    const [bets, transactions] = await Promise.all([betsAggregation, transactionsAggregation]);

    return { bets, transactions };

  }catch(error){

  }
  };





async getActivitiesByDate(req: Request, res: Response, next:NextFunction) {
    try {
      const { date } = req.query;

      if (!date) {
        throw createHttpError(400, "Date query parameter is required" )
      }
        const activities = await DailyActivity.find({
            date: {
                $eq: new Date(date as string) 
            }
        })
        .populate({
            path: 'actvity', 
            model: 'Activity'
        })
        .populate({
            path: 'player', 
            model: 'Player'
        });

        return res.status(200).json(activities);
    } catch (error) {
        next(error);
    }
};


async getAllDailyActivitiesOfAPlayer(req: Request, res: Response, next:NextFunction){
  try {
      const { player } = req.params;
      const playerDetails = await Player.findOne({username:player});
      if(!playerDetails){
        throw createHttpError(404, "Player not found")
      }
      const getAllDailyActivitiesOfAPlayer = await DailyActivity.find({player:playerDetails._id})
      console.log(getAllDailyActivitiesOfAPlayer, playerDetails._id);
      
      return res.status(200).json(getAllDailyActivitiesOfAPlayer);
  } catch (error) {
     next(error)
  }
}
}

export default new UserActivityController()