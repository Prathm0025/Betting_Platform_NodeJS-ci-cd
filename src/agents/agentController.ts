import { NextFunction, Request, Response } from "express";
import createHttpError from 'http-errors';
import bcrypt from "bcrypt";
import Agent from "./agentModel";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import Admin from "../admin/adminModel";
import { IAgent } from "./agentType";

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

             const admin = await Admin.findById(userId);
            if (admin) {
                admin.agents.push(newAgent._id as unknown as mongoose.Schema.Types.ObjectId);
                await admin.save();
            } else {
                throw createHttpError(404, "Agent not found");
            }
             res.status(201).json({ message :"Agent Created Succesfully", Agent:newAgent});
        } catch (err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    }

    async getAgent(req: Request, res: Response, next: NextFunction) {
        const { id } = req.params;
        try {
            const agent = await Agent.findById(id);
            if (!agent) {
                return next(createHttpError(404, "Agent not found"));
            }
            res.status(200).json({ agent });
        } catch (err) {
            console.error(err);
            next(createHttpError (500, "Internal Server Error"));
        }
    }

    async getAllAgents(req: Request, res: Response, next: NextFunction) {
        try {
            const agents = await Agent.find();
            res.status(200).json({ agents });
        } catch (err) {
            console.error(err);
            next(createHttpError(500, "Internal Server Error"));
        }
    }

    async updateAgent(req: Request, res: Response, next: NextFunction) {
        const { id } = req.params;
        const { username, password, status } = req.body;
        try {
            const updateData: Partial<Record<keyof IAgent, any>> = {
                ...(username && { username }),
                ...(password && { password: await bcrypt.hash(password, AgentController.saltRounds) }),
                ...(status && { status})
            };
            

            const updatedAgent = await Agent.findByIdAndUpdate(id, updateData, { new: true });
            if (!updatedAgent) {
                return next(createHttpError(404, "Agent not found"));
            }

            res.status(200).json({ message: "Agent updated successfully", agent: updatedAgent });
        } catch (err) {
            console.error(err);
            next(createHttpError(500, "Internal Server Error"));
        }
    }

    async deleteAgent(req: Request, res: Response, next: NextFunction) {
        const { id } = req.params;
        try {
            const deletedAgent = await Agent.findByIdAndDelete(id);
            if (!deletedAgent) {
                return next(createHttpError(404, "Agent not found"));
            }

            const _req = req as AuthRequest;
           const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
            const admin = await Admin.findById(userId);
           if (admin) {
            admin.agents = admin.agents.filter(agentId => agentId.toString() !== id);
            await admin.save();
           }

            res.status(200).json({ message: "Agent deleted successfully" });
        } catch (err) {
            console.error(err);
            next(createHttpError(500, "Internal Server Error"));
        }
    }


}

export default new AgentController()