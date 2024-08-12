import { NextFunction, Request, Response } from "express";
import Admin from "./adminModel";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import Agent from "../agents/agentModel";
class AdminController {
  static saltRounds: Number = 10;

  async createAdmin(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body;

    try {
      if (!username || !password) {
        throw createHttpError(400, "Username, password are required");
      }
      const existingAdmin = await Admin.findOne({ username: username });
      if (existingAdmin) {
        throw createHttpError(400, "username already exists");
      }
      const hashedPassword = await bcrypt.hash(
        password,
        AdminController.saltRounds
      );
      const newAdmin = new Admin({ username, password: hashedPassword });
      newAdmin.credits = Infinity;
      newAdmin.role = "admin";
      await newAdmin.save();
      res
        .status(201)
        .json({ message: "Admin Created Succesfully", admin: newAdmin });
    } catch (error) {
      next(error);
    }
  }
  async getAdminAgentsandAgentPlayers(req:Request, res:Response, next:NextFunction){
    try {
      const {adminId} = req.params;
      if(!adminId)
        throw createHttpError(400, "Admin Not Found")
      const agents = await Agent.find({createdBy:adminId}).populate("players");
     if (agents.length===0)
      res.status(200).json({message:"No Agents for Admin"});      
      res.status(200).json({message:"Success!", agents:agents});
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
