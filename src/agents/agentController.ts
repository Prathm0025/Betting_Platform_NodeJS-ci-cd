import { NextFunction, Request, Response } from "express";
import createHttpError from 'http-errors';
import bcrypt from "bcrypt";
import Agent from "./agentModel";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";

class AgentController {
    static saltRounds: Number = 10;
    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Agent" })
    }
    async createAgent(req: Request, res:Response, next: NextFunction){
        const {username, password} = req.body;
        if(!username || !password ){
            throw createHttpError(400, "Username, password are required");        
        }
        try {
            const _req = req as AuthRequest;
            const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
            const existingAgent = await Agent.findOne({ username:username });
            if(existingAgent){
                return res.status(400).json({message: "username already exists"});
            }  
             const hashedPassword = await bcrypt.hash(password, AgentController.saltRounds);
             const newAgent = new Agent({username, password: hashedPassword, createdBy:userId});
             newAgent.role = "agent";
             await newAgent.save();
             res.status(201).json({ message :"Agent Created Succesfully", Agent:newAgent});
        } catch (err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    }
}

export default new AgentController()