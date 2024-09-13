import createHttpError from "http-errors";
import { NextFunction, Request, Response } from "express";
import NotificationService from "./notificationServices";

class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // Using arrow functions to preserve `this` context
  public getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    const { recipientId } = req.params;

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

  public markNotificationAsViewed = async (notificationId: string) => {
    try {
      if (!notificationId) {
        throw createHttpError(400, "Notification ID is required");
      }

      await this.notificationService.update(notificationId);
    } catch (error) {
      return error;
    }
  };
}

export default new NotificationController();