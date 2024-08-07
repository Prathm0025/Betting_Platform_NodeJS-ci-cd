import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import Player from "../players/playerModel";
import bcrypt from "bcrypt";
import Agent from "../agents/agentModel";

class PlayerController {
    static saltRounds: Number = 10;

    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Admin" })
    }
    async createPlayer(req: Request, res:Response, next: NextFunction){
        const {username, password} = req.body;
        if(!username || !password ){
            throw createHttpError(400, "Username, password are required");        
        }
        try {
            const _req = req as AuthRequest;
            const userId = new mongoose.Types.ObjectId(_req?.user?.userId);
            const existingUser = await Player.findOne({ username:username });
            if(existingUser){
                return res.status(400).json({message: "username already exists"});
            }  
             const hashedPassword = await bcrypt.hash(password, PlayerController.saltRounds);
             const newUser = new Player({username, password: hashedPassword, createdBy:userId});
             await newUser.save();

            const agent = await Agent.findById(userId);
            if (agent) {
                agent.players.push(newUser._id as unknown as mongoose.Schema.Types.ObjectId);
                await agent.save();
            } else {
                throw createHttpError(404, "Agent not found");
            }
            res.status(201).json({ message :"Player Created Succesfully", palyer:newUser});

        } catch (err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    }
}

export default new PlayerController()