import mongoose from "mongoose";
import Player from "../players/playerModel";
import createHttpError from "http-errors";
import User from "../users/userModel";
import Notification from "./notificationModel";
import Bet from "../bets/betModel";
import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../utils/utils";

class NotificationController {
    public async createNotification(
        initiatorId: mongoose.Types.ObjectId,
        type: "error" | "success",
        message: string,
        reference: "bet" | "transaction",
        referenceId: mongoose.Types.ObjectId,
        action:string
      ): Promise<void> {
        try {
          
            const user:any =
            (await User.findById(initiatorId)) ||
            (await Player.findById(initiatorId));
    
          if (!user) {
            throw createHttpError(401, "User not found");
          }

          const initiatorModel = user.role !== "player"? 'User':'Player';
  
         let targetId;
         let targetModel;
         if(user.role !=="admin"){
          targetId= user.createdBy
          const targetUser:any =  (await User.findById(targetId)) ||
          (await Player.findById(targetId));
          if (!targetUser) {
            throw createHttpError(401, "Target User not found");
          }

          targetModel = targetUser.role === "player"? 'Player':'User';

         }else{
            targetId=null;
            targetModel=null;
         }

         
          const newNotification = new Notification({
            initiatorId,
            targetId,
            initiatorModel,
            targetModel,
            type,
            message,
            reference,
            referenceId,
            status: "pending",
            action: action
          });
    
          const savedNotification = await newNotification.save();
    
        //   let updateResult;
        //   if (targetModel === "Player") {
        //     updateResult = await Player.findByIdAndUpdate(
        //       targetId,
        //       { $push: { notifications: savedNotification._id } },
        //       { new: true, useFindAndModify: false }
        //     );
        //   } else if (targetModel === "User") {
        //     updateResult = await User.findByIdAndUpdate(
        //       targetId,
        //       { $push: { notifications: savedNotification._id } },
        //       { new: true, useFindAndModify: false }
        //     );
        //   }
    
        //   if (!updateResult) {
        //     throw new Error(`Failed to update ${targetModel} with id ${targetId}`);
        //   }
    
          console.log("Notification created and target updated successfully.");
        } catch (error) {
          console.error("Error creating notification:", error);
          throw new Error("Failed to create notification.");
        }
      }
    
     async getUserNotification(req: Request, res: Response, next:NextFunction){
        const _req = req as AuthRequest;
        const { userId} = _req.user;    
        try {    
            const notifications = await Notification.find({ targetId: userId });    
            if (!notifications ) {
                throw createHttpError(404, "No notifications found for user")
            }
            return res.status(200).json(
                notifications,
            );
        } catch (error) {
            next(error);
        }
    };
    async resolveNotification(req:Request, res:Response, next:NextFunction){
      try {
        const  { notificationId } = req.params;
        const {status} = req.body;
        const notificaion  = await Notification.findById(notificationId);
        if(!notificaion){
          throw createHttpError(404, "Notification not found!");
        }
        notificaion.status = status;
        await notificaion.save();
        res.status(200).json({
          message:"Notification Resolved"
        })
      } catch (error) {
        next(error)
      }
    }
    
}



export default new NotificationController();

