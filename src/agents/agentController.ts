import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import Agent from "./agentModel";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import Admin from "../admin/adminModel";
import { IAgent } from "./agentType";

class AgentController {
  static saltRounds: Number = 10;
  
  //CREATE AN AGENT

  async createAgent(req: Request, res: Response, next: NextFunction) {
    
    try {
      const { username, password } = req.body;
    if (!username || !password) {
      throw createHttpError(400, "Username, password are required");
    }
      const _req = req as AuthRequest;
      const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
      const existingAgent = await Agent.findOne({ username: username });
      if (existingAgent) {
        throw createHttpError(400, "username already exists");
      }
      const hashedPassword = await bcrypt.hash(
        password,
        AgentController.saltRounds
      );
      const newAgent = new Agent({
        username,
        password: hashedPassword,
        createdBy: userId,
      });
      newAgent.role = "agent";
      await newAgent.save();

      const admin = await Admin.findById(userId);
      if (admin) {
        admin.agents.push(
          newAgent._id as unknown as mongoose.Schema.Types.ObjectId
        );
        await admin.save();
      } else {
        throw createHttpError(404, "Agent not found");
      }
      res
        .status(201)
        .json({ message: "Agent Created Succesfully", Agent: newAgent });
    } catch (error) {
      next(error);
    }
  }
  
  //GET SPECIFC AGENT
  
  async getAgent(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const agent = await Agent.findById(id);
      if (!agent) {
        throw createHttpError(404, "Agent not found");
      }
      res.status(200).json({ agent });
    } catch (error) {
      next(error);
    }
  }


  //GET ALL AGENTS

  async getAllAgents(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("HERE");
      const agents = await Agent.find();
      res.status(200).json({ agents });
    } catch (error) {
      next(error);
    }
  }

//UPDATE AN AGENT

  async updateAgent(req: Request, res: Response, next: NextFunction) {
    const {id, username, password, status} = req.body;
    console.log(req.body);
    
    try {
      const updateData: Partial<Record<keyof IAgent, any>> = {
        ...(username && { username }),
        ...(password && {
          password: await bcrypt.hash(password, AgentController.saltRounds),
        }),
        ...(status && { status }),
      };

      const updatedAgent = await Agent.findByIdAndUpdate(id, updateData, {
        new: true,
      });
      if (!updatedAgent) {
        console.log("HERE");
        throw createHttpError(404, "Agent not found");
      }

      res
        .status(200)
        .json({ message: "Agent updated successfully", agent: updatedAgent });
    } catch (error) {
      next(error);
    }
  }

  //DELETE AN AGENT

  async deleteAgent(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const deletedAgent = await Agent.findByIdAndDelete(id);
      if (!deletedAgent) {
        throw createHttpError(404, "Agent not found");
      }

      const _req = req as AuthRequest;
      const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
      const admin = await Admin.findById(userId);
      if (admin) {
        admin.agents = admin.agents.filter(
          (agentId) => agentId.toString() !== id
        );
        await admin.save();
      }

      res.status(200).json({ message: "Agent deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

 //GET PLAYERS UNDER AN AGENT 
   
 async getPlayersUnderAgent(req: Request, res: Response, next: NextFunction) {
  try {
    const { agentId, username } = req.params;

    let agent:any;

    if (agentId) {
      agent = await Agent.findById(agentId).populate({
        path: 'players',
        select: '-password'
      });;
      if (!agent) throw createHttpError(404, "Agent Not Found");
    } else if (username) {
      agent = await Agent.findOne({ username }) .populate({
        path: 'players',
        select: '-password' 
      });;
      if (!agent) throw createHttpError(404, "Agent Not Found with the provided username");
    } else {
      throw createHttpError(400, "Agent Id or Username not provided");
    }

    const playersUnderAgent = agent.players;

    if (playersUnderAgent.length === 0) {
      return res.status(200).json({ message: "No Players Under Agent" });
    }

    return res.status(200).json({ message: "Success!", players: playersUnderAgent });

  } catch (error) {
    next(error);
  }
}

}

export default new AgentController();
