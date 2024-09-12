import { log } from "console";
import Player from "../players/playerModel";
import DailyActivity, { Activity } from "./userActivityModel"
import createHttpError from "http-errors";

class UserActivityController{
  
    async createActiviySession(username:string,startTime:Date){
        try {
           const player = await Player.findOne({username:username});
           if(!player){
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
       
        if(!dailyActivity){
          dailyActivity = new DailyActivity({
            date:today,
            player:player._id,
          })
          await dailyActivity.save();
        }
       const updateDailyActivity = await DailyActivity.findByIdAndUpdate(dailyActivity._id, {
        $push:{actvity:savedNewActivitySession._id},
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
    
        const latestActivitySession:any = dailyActivity.actvity.find((activity:any) => activity.endTime === null);
    
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
    
}

export default new UserActivityController()