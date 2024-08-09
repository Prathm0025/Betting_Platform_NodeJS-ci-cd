import { NextFunction, Request, Response } from "express";
import Admin from "./adminModel";
import createHttpError from "http-errors";
import bcrypt from "bcrypt";
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
}

export default new AdminController();
