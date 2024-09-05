import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import { sanitizeInput } from "../utils/utils";
import User from "../users/userModel";
class AdminController {
  static saltRounds: Number = 10;
  //CREATE AN ADMIN

  async createAdmin(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body;

    try {
      const sanitizedUsername = sanitizeInput(username);
      const sanitizedPassword = sanitizeInput(password);
      if (!sanitizedUsername || !sanitizedPassword) {
        throw createHttpError(400, "Username, password are required");
      }
      const existingAdmin = await User.findOne({ username: username });
      if (existingAdmin) {
        throw createHttpError(400, "Username already exists");
      }
      const hashedPassword = await bcrypt.hash(
        sanitizedPassword,
        AdminController.saltRounds
      );
      const newAdmin = new User({ sanitizedUsername, password: hashedPassword });
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

  //GET AGENT UNDER ADMIN AND PLAYERS UNDER THOSE AGENTS

  // async getAdminAgentsandAgentPlayers(req:Request, res:Response, next:NextFunction){
  //   try {
  //     const {adminId} = req.params;
  //     if(!adminId)
  //       throw createHttpError(400, "Admin Not Found")
  //     const agents = await Agent.find({createdBy:adminId}).populate("players");
  //    if (agents.length===0)
  //     res.status(200).json({message:"No Agents for Admin"});      
  //     res.status(200).json({message:"Success!", agents:agents});
  //   } catch (error) {
  //     next(error);
  //   }
  // }
}

export default new AdminController();
