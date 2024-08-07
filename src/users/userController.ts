import { NextFunction, Request, Response } from "express";
import User from "./userModel";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../utils/utils";
import mongoose from "mongoose";
import Player from "../players/playerModel";

class UserController {
    static saltRounds: Number = 10;
  
  sayHello(req: Request, res: Response, next: NextFunction) {
    res.status(200).json({ message: "Admin" });
  }

  async login(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body;
    if (!username || !password) {
      throw createHttpError(400, "Username, password are required");
    }
    try {
      let user;  
       user = await User.findOne({ username });
      if (!user) {
        user = await Player.findOne({ username});
        if(!user){
        throw createHttpError(401, "User not found");
        }
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createHttpError(401, "Invalid password");
      }

      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
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
    } catch (err) {
        console.log(err);
        next(err);        
    }
  }

  async createUser(req: Request, res:Response, next: NextFunction){
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
         const hashedPassword = await bcrypt.hash(password, UserController.saltRounds);
         const newUser = new Player({username, password: hashedPassword, createdBy:userId});
         await newUser.save();
         res.status(201).json({ message :"User Created Succesfully", User:newUser});
    } catch (err) {
        console.log(err);
        res.status(500).json({ message : "Internal Server Error"});
    }
}
}

export default new UserController();
