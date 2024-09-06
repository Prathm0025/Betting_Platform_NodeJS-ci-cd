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

}

export default new AdminController();
