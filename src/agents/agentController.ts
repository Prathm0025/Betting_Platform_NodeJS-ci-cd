import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import Agent from "./agentModel";
import { AuthRequest, sanitizeInput } from "../utils/utils";
import mongoose from "mongoose";
import Admin from "../admin/adminModel";
import { IAgent } from "./agentType";

class AgentController {
  static saltRounds: Number = 10;
  
  //CREATE AN AGENT

  async createAgent(req: Request, res: Response, next: NextFunction) {
    
    try {
      const { username, password } = req.body;
      const sanitizedUsername = sanitizeInput(username);
      const sanitizedPassword = sanitizeInput(password);
    if (!sanitizedUsername || !sanitizedPassword) {
      throw createHttpError(400, "Username, password are required");
    }
      const _req = req as AuthRequest;
      const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
      const existingAgent = await Agent.findOne({ username: username });
      if (existingAgent) {
        throw createHttpError(400, "username already exists");
      }
      const hashedPassword = await bcrypt.hash(
        sanitizedPassword,
        AgentController.saltRounds
      );
      const newAgent = new Agent({
        sanitizedUsername,
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
  const { username, password, status } = req.body;
  const { id: agentId } = req.params;

  try {
    const _req = req as AuthRequest;
    const { userId, role } = _req.user;

    const sanitizedUsername = username ? sanitizeInput(username) : undefined;
    const sanitizedPassword = password ? sanitizeInput(password) : undefined;
    const sanitizedStatus = status ? sanitizeInput(status) : undefined;

    const updateData: Partial<Record<keyof IAgent, any>> = {
      ...(sanitizedUsername && { username: sanitizedUsername }),
      ...(sanitizedPassword && {
        password: await bcrypt.hash(sanitizedPassword, AgentController.saltRounds),
      }),
      ...(sanitizedStatus && { status: sanitizedStatus }),
    };

    if (role === "admin") {
      const agent = await Agent.findById(agentId);
      if (!agent) {
        throw createHttpError(404, "Agent not found");
      }
    } else {
      throw createHttpError(403, "You do not have permission to update agents");
    }
    const updatedAgent = await Agent.findByIdAndUpdate(agentId, updateData, {
      new: true,
    });

    if (!updatedAgent) {
      throw createHttpError(404, "Agent not found");
    }

    res.status(200).json({
      message: "Agent updated successfully",
      agent: updatedAgent,
    });
  } catch (error) {
    console.log(error);
    
    next(error);
  }
}

  //DELETE AN AGENT

  async deleteAgent(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const _req = req as AuthRequest;
      const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
      const admin = await Admin.findById(userId);
      if(!admin){
        throw createHttpError(401, "You are not Authorised");
      }
      const deletedAgent = await Agent.findByIdAndDelete(id);
      if (!deletedAgent) {
        throw createHttpError(404, "Agent not found");
      }

     
      
        admin.agents = admin.agents.filter(
          (agentId) => agentId.toString() !== id
        );
        await admin.save();
      

      res.status(200).json({ message: "Agent deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

 //GET PLAYERS UNDER AN AGENT 
   
 async getPlayersUnderAgent(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("Hi");
    
    const { agent } = req.params;
     const {type} = req.query;
    let agentPlayers:any;

    if (type==="id") {
      agentPlayers = await Agent.findById(agent).populate({
        path: 'players',
        select: '-password'
      });;
      if (!agent) throw createHttpError(404, "Agent Not Found");
    } else if (type==="username") {
      agentPlayers = await Agent.findOne({ username:agent }) .populate({
        path: 'players',
        select: '-password' 
      });;
      if (!agentPlayers) throw createHttpError(404, "Agent Not Found with the provided username");
    } else {
      throw createHttpError(400, "Agent Id or Username not provided");
    }

    const playersUnderAgent = agentPlayers.players;

    if (playersUnderAgent.length === 0) {
      return res.status(200).json({ message: "No Players Under Agent" });
    }

    return res.status(200).json({ message: "Success!", players: playersUnderAgent });

  } catch (error) {
    console.log(error);
    
    next(error);
  }
}

}

export default new AgentController();
