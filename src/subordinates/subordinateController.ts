import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
import Agent from "./agentModel";
import { AuthRequest, hasPermission, rolesHierarchy, sanitizeInput } from "../utils/utils";
import mongoose from "mongoose";
import { IAgent } from "./agentType";
import User from "../users/userModel";
import Player from "../players/playerModel";

class SubordinateController {
  static saltRounds: Number = 10;
  static readonly roles = Object.freeze([
    'all',
    'distributor',
    'sub_distributor',
    'agent',
    'player'
  ]);
  //CREATE SUBORDINATE

  async createSubordinate(req: Request, res: Response, next: NextFunction) {

    try {

      //INPUT

      const { username, password, role } = req.body;

      const sanitizedUsername = sanitizeInput(username);
      const sanitizedPassword = sanitizeInput(password);
      const sanitizedRole = sanitizeInput(role);

      if (!sanitizedUsername || !sanitizedPassword || !sanitizedRole)
        throw createHttpError(400, "Username, password and role are required");

      //SUPERIOR USER OR CREATOR

      const _req = req as AuthRequest;
      const { userId, role: requestingUserRole } = _req.user;
      const superior = await User.findById(userId);
      if (!superior)
        throw createHttpError(401, "Unauthorized");

      // PERMISSION CHECK

      const hasPermissionToCreate = () => {
        const allowedRoles = rolesHierarchy[requestingUserRole] || [];
        if (requestingUserRole !== superior.role)
          return allowedRoles.includes(sanitizedRole);
        return false;
      }

      if (!hasPermissionToCreate)
        throw createHttpError(403, "¸");

      //CREATE

      const existingSubordinate = await User.findOne({ username: sanitizedUsername });
      if (existingSubordinate) {
        throw createHttpError(400, "username already exists");
      }
      const hashedPassword = await bcrypt.hash(
        sanitizedPassword,
        SubordinateController.saltRounds
      );
      let newSubordinate: any;
      if (sanitizedRole === "agent") {
        newSubordinate = new Agent(
          {
            username: sanitizedUsername,
            password: hashedPassword,
            role: sanitizedRole,
            createdBy: userId,
          }
        )
      } else {
        newSubordinate = new User({
          username: sanitizedUsername,
          password: hashedPassword,
          role: sanitizedRole,
          createdBy: userId,
        });
      }
      await newSubordinate.save();

      //STORE REFERENCE OF SUBORFINATE FOR SUPERIOR

      superior.subordinates.push(
        newSubordinate._id as unknown as mongoose.Schema.Types.ObjectId
      );
      await superior.save();

      //RESPONSE

      res
        .status(201)
        .json({ message: `${role} Created Succesfully`, Subordinate: newSubordinate });
    } catch (error) {
      next(error);
    }
  }

  //GET SPECIFC SUBORDINATE

  async getSubordinate(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const subordinate = await User.findById(id);
      if (!subordinate) {
        throw createHttpError(404, "User not found");
      }
      res.status(200).json(subordinate);
    } catch (error) {
      next(error);
    }
  }
  

  //GET ALL SUBORDINATES  (ADMIN SPECIFC)

  async getAllSubordinates(req: Request, res: Response, next: NextFunction) {
    try { 
      const { type } = req.query;
      
      if (!SubordinateController.roles.includes(type as string)) {
        throw createHttpError(400, "Invalid role type");
      }


      const _req = req as AuthRequest;
      const { userId } = _req.user;

      const admin = await User.findById(userId)
      if (!admin)
      throw createHttpError(401, "You are Not Authorized")
      
      //GETTING USERS BASED ON QUERY

      let subordinates:any;

      if(type==="all"){
       const user = await User.find();
       const player = await Player.find();
       subordinates = [...user, ...player];
      }
      else
       if(type==="player")
       subordinates = await Player.find();
       else 
       subordinates = await User.find({
        role:type
      });

      res.status(200).json(subordinates);
    } catch (error) {
      next(error);
    }
  }

  //UPDATE USER (SUBORDINATES)

  async updateSubordinate(req: Request, res: Response, next: NextFunction) {
    const { username, password, status } = req.body;
    const { id } = req.params;

    try {

      //INPUT

      const sanitizedUsername = username ? sanitizeInput(username) : undefined;
      const sanitizedPassword = password ? sanitizeInput(password) : undefined;
      const sanitizedStatus = status ? sanitizeInput(status) : undefined;

      const _req = req as AuthRequest;
      const { userId, role } = _req.user;

      // PERMISSION CHECK

      const hasPermissionToUpadte = await hasPermission(
        userId,
        id,
        role
      );

      if (!hasPermissionToUpadte) {
        throw createHttpError(403, "You do not have permission to update this user.");
      }

      //UPDATE

      const updateData: Partial<Record<keyof IAgent, any>> = {
        ...(sanitizedUsername && { username: sanitizedUsername }),
        ...(sanitizedPassword && {
          password: await bcrypt.hash(sanitizedPassword, SubordinateController.saltRounds),
        }),
        ...(sanitizedStatus && { status: sanitizedStatus }),
      };
      const updateSubordinate = await User.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      if (!updateSubordinate) {
        throw createHttpError(404, "User not found");
      }

      res.status(200).json({
        message: "User updated successfully",
        agent: updateSubordinate,
      });
    } catch (error) {
      console.log(error);

      next(error);
    }
  }

  //DELETE SUBORDINATE

  async deleteSubordinate(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params;
    try {
      const _req = req as AuthRequest;
      const { userId, role } = _req.user;
      const superior = await User.findById(userId);
      if (!superior)
        throw createHttpError(401, "Unauthorized");

      //PERMISSION CHECK

      const hasPermissionToDelete = await hasPermission(
        userId,
        id,
        role
      )
      if (!hasPermissionToDelete)
        throw createHttpError(401, "You do not have permission to delete this user");

      //DELETE

      const deleteSubordinate = await User.findByIdAndDelete(id);
      if (!deleteSubordinate)
        throw createHttpError(404, "Unable to Delete")

      //REMOVING SUBORDINATE REFERENCE FROM SUPERIOR

      superior.subordinates = superior.subordinates.filter(
        (superiorId) => superiorId.toString() !== id
      );

      await superior.save();

      res.status(200).json({ message: "User deleted successfully" });

    } catch (error) {

      next(error);
    }
  }

  //GET SUBORDINATE UNDER SUPERIOR

  async getSubordinatessUnderSuperior(req: Request, res: Response, next: NextFunction) {
    try {

      const { superior } = req.params;
      const { type } = req.query;


      let superiorUser: any;
      // GETTING SUBORDINATE BASED ON QUERY TYPE(username, id)
      if (type === "id") {
        superiorUser = await User.findById(superior).populate({
          path: 'subordinates',
          select: '-password'
        });

        //PLAYERS FOR AGENT(AGENT HAS PLAYERS AS SUBORDINATE)

        if (superiorUser.role === "agent")
          superiorUser = await Agent.findById(superior).populate({
            path: 'players',
            select: '-password'
          })
        if (!superiorUser) throw createHttpError(404, "User Not Found");
      } else if (type === "username") {
        superiorUser = await User.findOne({ username: superior }).populate({
          path: 'subordinates',
          select: '-password'
        });

        if (superiorUser.role === "agent")
          superiorUser = await Agent.findOne({ username: superior }).populate({
            path: 'players',
            select: '-password'
          })

        if (!superiorUser) throw createHttpError(404, "User Not Found with the provided username");
      } else {
        throw createHttpError(400, "Usr Id or Username not provided");
      }

      // ACCESS SUBORDINATE DEPENDING ON ROLE

      let subordinates
        = superiorUser.role !== "agent" ? superiorUser.subordinates : superiorUser.players;

      if (subordinates.length === 0) {
        return res.status(200).json({ message: "No Subordinate Under User" });
      }

      return res.status(200).json(subordinates);

    } catch (error) {
      console.log(error);

      next(error);
    }
  }

}

export default new SubordinateController();
