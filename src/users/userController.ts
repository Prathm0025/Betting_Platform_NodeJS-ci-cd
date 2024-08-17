import { NextFunction, Request, Response } from "express";
import User from "./userModel";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Player from "../players/playerModel";
import { config } from "../config/config";
import { AuthRequest } from "../utils/utils";
import svgCaptcha from "svg-captcha";
import { v4 as uuidv4 } from 'uuid';
import mongoose from "mongoose";
import Transaction from "../transactions/transactionModel";
import Bet from "../bets/betModel";
import Agent from "../agents/agentModel";

const captchaStore: Record<string, string> = {}; 

class UserController {
  static saltRounds: Number = 10;
  constructor() {
    // Bind each method to 'this'
    this.getSummary = this.getSummary.bind(this);
    // Repeat for other methods as necessary
  }


  //TO GET CAPTCHA

  async getCaptcha(req: Request, res: Response, next: NextFunction) {
    try {
      const captcha = svgCaptcha.create();
      console.log(captcha.text);
      const captchaId = uuidv4(); 
      captchaStore[captchaId] = captcha.text;

      const captchaToken = jwt.sign({ captchaId }, config.jwtSecret, {
        expiresIn: "5m", 
      });

      res.status(200).json({ captcha: captcha.data, token: captchaToken });
    } catch (err) {
      next(err);
    }
  }

  //LOGIN

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password, captchaToken, captcha } = req.body;
      console.log(req.body);
      
      if (!username || !password || !captchaToken || !captcha) {
        throw createHttpError(400, "Username, password, CAPTCHA, and token are required");
      }
      const decoded = jwt.verify(captchaToken, config.jwtSecret) as { captchaId: string };
      const expectedCaptcha = captchaStore[decoded.captchaId];

      if (captcha !== expectedCaptcha) {
        throw createHttpError(400, "Invalid CAPTCHA");
      }

      
      delete captchaStore[decoded.captchaId];

      const user =
        (await User.findOne({ username })) ||
        (await Player.findOne({ username }));

      if (!user) {
        throw createHttpError(401, "User not found");
      }

      const userStatus = user.status==="inactive"
      if(userStatus){
        throw createHttpError(403, "You are Blocked!")
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createHttpError(401, "Incoreect password");
      }

      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        { userId: user._id, username: user.username, role: user.role, credits:user.credits },
        config.jwtSecret,
        { expiresIn: "24h" }
      );
      res.cookie("userToken", token, {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: "none",
      });

      res.status(200).json({
        message: "Login successful",
        token: token,
        role: user.role,
      });
    } catch (err) {
      console.log(err);
      next(err);
    }
  }

  //CURRENT LOGGED IN USER

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { userId } = _req.user;
      if (!userId) throw createHttpError(400, "Invalid Request, Missing User");
      const user =
        (await User.findById({ _id: userId })) ||
        (await Player.findById({ _id: userId }));
      if (!user) throw createHttpError(404, "User not found");
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
  
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      // const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      // const last30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);

      const limitBets = parseInt(req.query.limitBets as string) || 4;
      const limitTransactions = parseInt(req.query.limitTransactions as string) || 10;
      const lastDays = parseInt(req.query.lastDays as string) || 30;

      const lastPeriodDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - lastDays);

      const [lastBets, lastTransactions, betTotals, transactionTotals, agentCounts, playerCounts] = await Promise.all([
        this.getLastBets(limitBets),
        this.getLastTransactions(limitTransactions),
        this.getBetTotals(startOfDay, lastPeriodDate),
        this.getTransactionTotals(startOfDay, lastPeriodDate),
        this.getAgentCounts(startOfDay, lastPeriodDate),
        this.getPlayerCounts(startOfDay, lastPeriodDate),
      ]);

      const response = {
        lastBets,
        lastTransactions,
        betTotals: betTotals[0],
        transactionTotals: transactionTotals[0],
        agentCounts: agentCounts[0],
        playerCounts: playerCounts[0],
      };

      res.json(response);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  }

  private async getLastBets(limit: number) {
    return Bet.find().sort({ date: -1 }).limit(limit).exec();
  }

  private async getLastTransactions(limit: number) {
    return Transaction.find().sort({ date: -1 }).limit(limit).select('+senderModel +receiverModel')
    .populate({
      path: 'sender',
      select: 'username',
    })
    .populate({
      path: 'receiver',
      select: 'username',
    }).exec();
  }

  private async getBetTotals(startOfDay: Date, lastPeriodDate: Date) {
    return Bet.aggregate([
      {
        $match: { updatedAt: { $gte: lastPeriodDate } },
      },
      {
        $group: {
          _id: null,
          totalToday: { $sum: { $cond: [{ $gte: ['$date', startOfDay] }, '$amount', 0] } },
          totalLastPeriod: { $sum: '$amount' },
        },
      },
    ]).exec();
  }

  private async getTransactionTotals(startOfDay: Date, lastPeriodDate: Date) {
    return Transaction.aggregate([
      {
        $match: { date: { $gte: lastPeriodDate } },
      },
      {
        $group: {
          _id: null,
          totalToday: { $sum: { $cond: [{ $gte: ['$date', startOfDay] }, '$amount', 0] } },
          totalLastPeriod: { $sum: '$amount' },
        },
      },
    ]).exec();
  }

  private async getAgentCounts(startOfDay: Date, lastPeriodDate: Date) {
    return Agent.aggregate([
      {
        $match: { createdAt: { $gte: lastPeriodDate } },
      },
      {
        $group: {
          _id: null,
          agentsToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
          agentsLastPeriod: { $sum: 1 },
        },
      },
    ]).exec();
  }

  private async getPlayerCounts(startOfDay: Date, lastPeriodDate: Date) {
    return Player.aggregate([
      {
        $match: { createdAt: { $gte: lastPeriodDate } },
      },
      {
        $group: {
          _id: null,
          playersToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
          playersLastPeriod: { $sum: 1 },
        },
      },
    ]).exec();
  }

  

}



export default new UserController();