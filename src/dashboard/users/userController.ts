import { NextFunction, Request, Response } from "express";
import {
  AuthRequest,
  updateCredits,
  updatePassword,
  updateStatus,
  QueryParams,
} from "../../utils/utils";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../../config/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { User, Player } from "./userModel";
import UserService from "./userService";
// import Transaction from "../transactions/transactionModel";

export class UserController {
  private userService: UserService;
  private static rolesHierarchy = {
    superadmin: ["admin", "player"],
    admin: ["player"],
  };

  constructor() {
    this.userService = new UserService();
    this.loginUser = this.loginUser.bind(this);
    this.createUser = this.createUser.bind(this);
    this.getCurrentUser = this.getCurrentUser.bind(this);
    this.getAllSubordinates = this.getAllSubordinates.bind(this);
    this.getCurrentUserSubordinates =
      this.getCurrentUserSubordinates.bind(this);
  }

  public static getSubordinateRoles(role: string): string[] {
    return this.rolesHierarchy[role] || [];
  }

  public static isRoleValid(role: string, subordinateRole: string): boolean {
    return this.getSubordinateRoles(role).includes(subordinateRole);
  }

  async loginUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        throw createHttpError(400, "Username, password are required");
      }

      let user;
      user = await this.userService.findUserByUsername(username);

      if (!user) {
        user = await this.userService.findPlayerByUsername(username);

        if (!user) {
          throw createHttpError(401, "User not found");
        }
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw createHttpError(401, "Invalid username or password");
      }

      user.lastLogin = new Date();

      user.loginTimes = (user.loginTimes || 0) + 1;
      await user.save();

      const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        config.jwtSecret!,
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
    } catch (error) {
      console.log(error);

      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const _req = req as AuthRequest;
      const { user } = req.body;
      const { username, role } = _req.user;
      console.log(req.body);

      if (
        !user ||
        !user.name ||
        !user.username ||
        !user.password ||
        !user.role ||
        user.credits === undefined
      ) {
        throw createHttpError(400, "All required fields must be provided");
      }

      if (
        role !== "superadmin" &&
        !UserController.isRoleValid(role, user.role)
      ) {
        throw createHttpError(403, `A ${role} cannot create a ${user.role}`);
      }

      const admin = await this.userService.findUserByUsername(
        username,
        session
      );
      if (!admin) {
        throw createHttpError(404, "Admin not found");
      }

      let existingUser =
        (await this.userService.findPlayerByUsername(user.username, session)) ||
        (await this.userService.findUserByUsername(user.username, session));
      if (existingUser) {
        throw createHttpError(409, "User already exists");
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);

      let newUser;

      if (user.role === "player") {
        newUser = await this.userService.createPlayer(
          { ...user, createdBy: admin._id },
          0,
          hashedPassword,
          session
        );
      } else {
        newUser = await this.userService.createUser(
          { ...user, createdBy: admin._id },
          0,
          hashedPassword,
          session
        );
      }

      //   if (user.credits > 0) {
      //     const transaction = await this.userService.createTransaction(
      //       "recharge",
      //       admin,
      //       newUser,
      //       user.credits,
      //       session
      //     );
      //     newUser.transactions.push(transaction._id as mongoose.Types.ObjectId);
      //     admin.transactions.push(transaction._id as mongoose.Types.ObjectId);
      //   }

      await newUser.save({ session });
      admin.subordinates.push(newUser._id);

      await admin.save({ session });

      await session.commitTransaction();
      res.status(201).json(newUser);
    } catch (error) {
      next(error);
    } finally {
      session.endSession();
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { username, role } = _req.user;

      let user;

      if (role === "player") {
        user = await this.userService.findPlayerByUsername(username);
      } else {
        user = await this.userService.findUserByUsername(username);
      }

      if (!user) {
        throw createHttpError(404, "User not found");
      }

      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  async getAllSubordinates(req: Request, res: Response, next: NextFunction) {
    try {
      const _req = req as AuthRequest;
      const { username: loggedUserName, role: loggedUserRole } = _req.user;

      const loggedUser = await this.userService.findUserByUsername(
        loggedUserName
      );

      if (!loggedUser) {
        throw createHttpError(404, "User not found");
      }

      if (loggedUserRole !== "superadmin") {
        throw createHttpError(
          403,
          "Access denied. Only users with the role 'superadmin' can access this resource."
        );
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const filter = req.query.filter || "";
      const search = req.query.search as string;
      let parsedData: QueryParams = {
        role: "",
        status: "",
        totalRecharged: { From: 0, To: Infinity },
        totalRedeemed: { From: 0, To: Infinity },
        credits: { From: 0, To: Infinity },
        updatedAt: { From: null, To: null },
        type: "",
        amount: { From: 0, To: 0 },
      };

      let role, status, redeem, recharge, credits;

      if (search) {
        parsedData = JSON.parse(search);
        if (parsedData) {
          role = parsedData.role;
          status = parsedData.status;
          redeem = parsedData.totalRedeemed;
          recharge = parsedData.totalRecharged;
          credits = parsedData.credits;
        }
      }

      let query: any = {};
      if (filter) {
        query.username = { $regex: filter, $options: "i" };
      }
      if (role) {
        query.role = { $ne: "company", $eq: role };
      } else if (!role) {
        query.role = { $ne: "superadmin" };
      }
      if (status) {
        query.status = status;
      }
      if (parsedData.totalRecharged) {
        query.totalRecharged = {
          $gte: parsedData.totalRecharged.From,
          $lte: parsedData.totalRecharged.To,
        };
      }

      if (parsedData.totalRedeemed) {
        query.totalRedeemed = {
          $gte: parsedData.totalRedeemed.From,
          $lte: parsedData.totalRedeemed.To,
        };
      }

      if (parsedData.credits) {
        query.credits = {
          $gte: parsedData.credits.From,
          $lte: parsedData.credits.To,
        };
      }

      const userCount = await User.countDocuments(query);
      const playerCount = await Player.countDocuments(query);

      const totalSubordinates = userCount + playerCount;
      const totalPages = Math.ceil(totalSubordinates / limit);

      if (totalSubordinates === 0) {
        return res.status(200).json({
          message: "No subordinates found",
          totalSubordinates: 0,
          totalPages: 0,
          currentPage: 0,
          subordinates: [],
        });
      }

      if (page > totalPages) {
        return res.status(400).json({
          message: `Page number ${page} is out of range. There are only ${totalPages} pages available.`,
          totalSubordinates,
          totalPages,
          currentPage: page,
          subordinates: [],
        });
      }

      let users = [];
      if (skip < userCount) {
        users = await User.find(query).skip(skip).limit(limit);
      }

      const remainingLimit = limit - users.length;
      let players = [];
      if (remainingLimit > 0) {
        const playerSkip = Math.max(0, skip - userCount);
        players = await Player.find(query)
          .skip(playerSkip)
          .limit(remainingLimit);
      }

      const allSubordinates = [...users, ...players];

      res.status(200).json({
        totalSubordinates,
        totalPages,
        currentPage: page,
        subordinates: allSubordinates,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUserSubordinates(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const _req = req as AuthRequest;
      const { username, role } = _req.user;
      const { id } = req.query;

      const currentUser = await User.findOne({ username });
      if (!currentUser) {
        throw createHttpError(401, "User not found");
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      let userToCheck = currentUser;

      if (id) {
        userToCheck = await User.findById(id);
        if (!userToCheck) {
          userToCheck = await Player.findById(id);
          if (!userToCheck) {
            return res.status(404).json({ message: "User not found" });
          }
        }
      }
      let filterRole, status, redeem, recharge, credits;
      const filter = req.query.filter || "";
      const search = req.query.search as string;
      let parsedData: QueryParams = {
        role: "",
        status: "",
        totalRecharged: { From: 0, To: Infinity },
        totalRedeemed: { From: 0, To: Infinity },
        credits: { From: 0, To: Infinity },
        updatedAt: { From: new Date(), To: new Date() },
        type: "",
        amount: { From: 0, To: 0 },
      };

      if (search) {
        parsedData = JSON.parse(search);
        if (parsedData) {
          filterRole = parsedData.role;
          status = parsedData.status;
          redeem = parsedData.totalRedeemed;
          recharge = parsedData.totalRecharged;
          credits = parsedData.credits;
        }
      }

      let query: any = {};
      query.createdBy = userToCheck._id;
      if (filter) {
        query.username = { $regex: filter, $options: "i" };
      }
      if (filterRole) {
        query.role = { $ne: "superadmin", $eq: filterRole };
      } else if (!filterRole) {
        query.role = { $ne: "superadmin" };
      }
      if (status) {
        query.status = status;
      }
      if (parsedData.totalRecharged) {
        query.totalRecharged = {
          $gte: parsedData.totalRecharged.From,
          $lte: parsedData.totalRecharged.To,
        };
      }

      if (parsedData.totalRedeemed) {
        query.totalRedeemed = {
          $gte: parsedData.totalRedeemed.From,
          $lte: parsedData.totalRedeemed.To,
        };
      }

      if (parsedData.credits) {
        query.credits = {
          $gte: parsedData.credits.From,
          $lte: parsedData.credits.To,
        };
      }

      let subordinates;
      let totalSubordinates;

      if (userToCheck.role === "admin") {
        totalSubordinates = await Player.countDocuments(query);
        subordinates = await Player.find(query)
          .skip(skip)
          .limit(limit)
          .select(
            "name username status role totalRecharged totalRedeemed credits"
          );
      } else if (userToCheck.role === "superadmin") {
        const userSubordinatesCount = await User.countDocuments(query);
        const playerSubordinatesCount = await Player.countDocuments(query);

        totalSubordinates = userSubordinatesCount + playerSubordinatesCount;
        const userSubordinates = await User.find(query)
          .skip(skip)
          .limit(limit)
          .select(
            "name username status role totalRecharged totalRedeemed credits"
          );

        const remainingLimit = limit - userSubordinates.length;

        const playerSubordinates =
          remainingLimit > 0
            ? await Player.find(query)
                .skip(Math.max(skip - userSubordinatesCount, 0))
                .limit(remainingLimit)
                .select(
                  "name username status role totalRecharged totalRedeemed credits"
                )
            : [];

        subordinates = [...userSubordinates, ...playerSubordinates];
      }

      const totalPages = Math.ceil(totalSubordinates / limit);

      if (totalSubordinates === 0) {
        return res.status(200).json({
          message: "No subordinates found",
          totalSubordinates: 0,
          totalPages: 0,
          currentPage: 0,
          subordinates: [],
        });
      }

      if (page > totalPages) {
        return res.status(400).json({
          message: `Page number ${page} is out of range. There are only ${totalPages} pages available.`,
          totalSubordinates,
          totalPages,
          currentPage: page,
          subordinates: [],
        });
      }

      res.status(200).json({
        totalSubordinates,
        totalPages,
        currentPage: page,
        subordinates,
      });
    } catch (error) {
      next(error);
    }
  }
}
