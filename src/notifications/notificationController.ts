import mongoose from "mongoose";
import Player from "../players/playerModel";
import createHttpError from "http-errors";
import User from "../users/userModel";
import Notification from "./notificationModel";
import Bet from "../bets/betModel";
import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../utils/utils";
import NotificationService from "./notificationServices";

class NotificationController {
  private notificationService: NotificationService

  constructor() {
    this.notificationService = new NotificationService();
  }

  public async getNotifications(req: Request, res: Response, next: NextFunction) {
    const _req = req as AuthRequest
    const { userId: recipientId } = _req.user;

    try {
      if (!recipientId) {
        throw createHttpError(400, "Recipient ID is required");
      }

      const notifications = await this.notificationService.get(recipientId);
      res.status(200).json(notifications);
    } catch (error) {
      next(error);
    }
  }

  public async createNotification(type: "alert" | "info" | "message", payload: any, recipientId: string) {
    try {
      if (!type || !payload || !recipientId) {
        throw createHttpError(400, "Type, payload, and recipientId are required");
      }

      const newNotification = await this.notificationService.create(type, payload, recipientId);
      return newNotification;
    } catch (error) {
      return error;
    }
  }


  public async markNotificationAsViewed(notificationId: string) {
    try {
      if (!notificationId) {
        throw createHttpError(400, "Notification ID is required");
      }
      await this.notificationService.update(notificationId);
    } catch (error) {
      return error
    }
  }

}



export default new NotificationController();
