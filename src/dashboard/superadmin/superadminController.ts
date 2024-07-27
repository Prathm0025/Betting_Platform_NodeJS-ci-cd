import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import { User } from "../users/userModel";

 export class SuperadminController {
   constructor() {
    this.createSuperadmin = this.createSuperadmin.bind(this);
   }
   async createSuperadmin(
     req: Request,
     res: Response,
     next: NextFunction
   ): Promise<void> {
     try {
       const { user } = req.body;
       if (!this.validateUserFields(user)) {
         throw createHttpError(
           400,
           "All required fields (name, username, password, role) must be provided"
         );
       }
       const existingCompany = await this.findSuperadminByUsername(
         user.username
       );
       if (existingCompany) {
         throw createHttpError(409, "Super admin already exists");
       }
       const hashedPassword = await this.hashPassword(user.password);
       const superadmin = await this.saveSuperadmin({
         name: user.name,
         username: user.username,
         password: hashedPassword,
         role: user.role,
         credits: Infinity, // Assign infinite credits
       });
       res.status(201).json(superadmin);
     } catch (error) {
       next(error);
     }
   }
   private validateUserFields(user: any): boolean {
     return user && user.name && user.username && user.password && user.role;
   }
   private async findSuperadminByUsername(
     username: string
   ): Promise<typeof User | null> {
     return User.findOne({ username });
   }
   private async hashPassword(password: string): Promise<string> {
     return bcrypt.hash(password, 10);
   }
   private async saveSuperadmin(userData: any) {
     const superadmin = new User(userData);
     await superadmin.save();
   }
 }
