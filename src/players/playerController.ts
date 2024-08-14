import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import Player from "../players/playerModel";
import bcrypt from "bcrypt";
import Agent from "../agents/agentModel";
import { IPlayer } from "./playerType";
import Admin from "../admin/adminModel";

class PlayerController {
  static saltRounds: Number = 10;

//CREATE A PLAYER

  async createPlayer(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body;
    if (!username || !password) {
      throw createHttpError(400, "Username, password are required");
    }
    try {
      const _req = req as AuthRequest;
      const { userId, role } = _req.user;
      const creatorId = new mongoose.Types.ObjectId(userId);

      const creator =
        role === "admin"
          ? await Admin.findById(creatorId)
          : await Agent.findById(creatorId);

      if (!creator) {
        throw createHttpError(404, "Creator not found");
      }
      const existingUser = await Player.findOne({ username: username });

      if (existingUser) {
        throw createHttpError(400, "Username already exists");
      }

      const hashedPassword = await bcrypt.hash(
        password,
        PlayerController.saltRounds
      );

      const newUser = new Player({
        username,
        password: hashedPassword,
        createdBy: creatorId,
      });
      await newUser.save();
      creator.players.push(
        newUser._id as unknown as mongoose.Schema.Types.ObjectId
      );
      await creator.save();

      res
        .status(201)
        .json({ message: "Player Created Succesfully", player: newUser });
    } catch (error) {
      next(error);
    }
  }

//GET SPECIFIC PLAYER

  async getPlayer(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const player = await Player.findById(id);
      if (!player) {
        throw createHttpError(404, "Player not found");
      }
      res.status(200).json({ player });
    } catch (error) {
      next(error);
    }
  }
//GET ALL PLAYERS 

  async getAllPlayers(req: Request, res: Response, next: NextFunction) {
    try {
      const players = await Player.find();
      res.status(200).json({ players });
    } catch (error) {
      next(error);
    }
  }

  //UPDATE PLAYER

  async updatePlayer(req: Request, res: Response, next: NextFunction) {
    const {id,  username, password, status } = req.body;
    try {
      const updateData: Partial<IPlayer> = {
        ...(username && { username }),
        ...(password && {
          password: await bcrypt.hash(password, PlayerController.saltRounds),
        }),
        ...(status && { status }),
      };

      const updatedPlayer = await Player.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedPlayer) {
        throw createHttpError(404, "Player not found");
      }

      res.status(200).json({
        message: "Player updated successfully",
        player: updatedPlayer,
      });
    } catch (error) {
      next(error);
    }
  }

//DELETE A PLAYER

  async deletePlayer(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const deletedPlayer = await Player.findByIdAndDelete(id);
      if (!deletedPlayer) {
        throw createHttpError(404, "Player not found");
      }

      const _req = req as AuthRequest;
      const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
      const agent = await Agent.findById(userId);
      if (agent) {
        agent.players = agent.players.filter(
          (playerId) => playerId.toString() !== id
        );
        await agent.save();
      }

      res.status(200).json({ message: "Player deleted successfully" });
    } catch (error) {
      next(error);
    }
  }
}

export default new PlayerController();
