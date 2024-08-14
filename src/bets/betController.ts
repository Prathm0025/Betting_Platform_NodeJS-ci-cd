import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import Agent from "../agents/agentModel";
import Bet from "./betModel";
import Admin from "../admin/adminModel";

class BetController {
    
    async getAgentBets(req:Request, res:Response, next:NextFunction){
      try {
        const {agentId} = req.params;
        if(!agentId) throw createHttpError(400, "Agent Id not Found");
        const agent = await Agent.findById(agentId);
        if(!agent) throw createHttpError(404, "Agent Not Found");
        const playerUnderAgent =agent.players;
        if(playerUnderAgent.length===0) 
        res.status(200).json({message:"No Players Under Agent"});
        const bets = await Bet.find({
            player:{$in:playerUnderAgent}
        })
        console.log(bets, "bets");
        if(bets.length===0)
        res.status(200).json({message:"No Bets Found"});
        res.status(200).json({message:"Success!", Bets:bets})
        
      } catch (error) {
        next(error);
      }
    }

    async getAdminBets(req:Request, res:Response, next:NextFunction){
        try {
           const { adminId } = req.params;
           const admin = await Admin.findById(adminId);
           if(!admin) throw createHttpError(404, "Admin Not Found");
           const playerUnderAdmin = admin.players;
           if(playerUnderAdmin.length===0)
           res.status(200).json({message:"No Player Found Under Admin"});
           const bets = await Bet.find({
            player:{$in:playerUnderAdmin}
           })
           console.log(bets, "bets");   
           if(bets.length===0)
           res.status(200).json({message:"No Bets Found"});
           res.status(200).json({message:"Success!", Bets:bets})
        } catch (error) {
            console.log(error);
            next(error)
        }
    }
     
    async getAdminAgentBets(req:Request, res:Response, next:NextFunction){
        try {
        const { adminId } = req.params;
        const admin = await Admin.findById(adminId);
        if (!admin) 
        throw createHttpError(404, "Admin not found");  
        const agents = await Agent.find({ createdBy: adminId });
        if (agents.length === 0) {
        return res.status(200).json({ message: "No agents found under this admin" });
        }
        const playerIds = agents.flatMap(agent => agent.players);
        console.log(playerIds, "playerIds");
        if (playerIds.length === 0) 
        return res.status(200).json({ message: "No players found under agents" });
        const bets = await Bet.find({ player: { $in: playerIds } });
        if (bets.length === 0) 
        return res.status(200).json({ message: "No bets found for players under agents" });
        res.status(200).json({ message: "Success!", Bets:bets });  
        } catch (error) {
        next(error);
        }
    }
    
    
}

export default new BetController()