import createHttpError from "http-errors";
import { NextFunction, Request, Response } from "express";
import NotificationService from "./notificationServices";

import { AuthRequest } from "../utils/utils";

class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // Using arrow functions to preserve `this` context
  public getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    const _req = req as AuthRequest;
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
  };

  public createNotification = async (type: "alert" | "info" | "message", payload: any, recipientId: string) => {
    try {
      if (!type || !payload || !recipientId) {
        throw createHttpError(400, "Type, payload, and recipientId are required");
      }

      const newNotification = await this.notificationService.create(type, payload, recipientId);
      return newNotification;
    } catch (error) {
      return error;
    }
  };

  public markNotificationAsViewed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { notifId } = req.params;
      if (!notifId) {
        throw createHttpError(400, "Notification ID is required");
      }


      await this.notificationService.update(notifId);
      res.status(200).json({ message: "Notification marked as viewed" });
    } catch (error) {
      console.error("Error marking notification as viewed:", error);
      next(error);
    }
  };
}

export default new NotificationController();
