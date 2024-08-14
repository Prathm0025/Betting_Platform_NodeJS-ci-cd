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

const captchaStore: Record<string, string> = {}; 

class UserController {
  static saltRounds: Number = 10;

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
    const _req = req as AuthRequest;
    const { userId } = _req.user;
    if (!userId) throw createHttpError(400, "Invalid Request, Missing User");
    try {
      const user =
        (await User.findById({ _id: userId })) ||
        (await Player.findById({ _id: userId }));
      if (!user) throw createHttpError(404, "User not found");
      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();