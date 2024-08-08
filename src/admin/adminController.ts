import { NextFunction, Request, Response } from "express";
import Admin from "./adminModel";
import createHttpError from 'http-errors';
import bcrypt from "bcrypt";
class AdminController {
    
    static saltRounds: Number = 10;
    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Admin" })
    }

    async createAdmin(req: Request, res:Response, next: NextFunction){
        const {username, password} = req.body;
        if(!username || !password ){
            throw createHttpError(400, "Username, password are required");        
        }
        try {
            const existingAdmin = await Admin.findOne({ username:username });
            if(existingAdmin){
                return res.status(400).json({message: "username already exists"});
            }  
             const hashedPassword = await bcrypt.hash(password, AdminController.saltRounds);
             const newAdmin = new Admin({username, password: hashedPassword});
             newAdmin.credits  = Infinity;
             newAdmin.role = "admin";
             await newAdmin.save();
             res.status(201).json({ message :"Admin Created Succesfully", admin:newAdmin});
        } catch (err) {
            console.log(err);
            res.status(500).json({ message : "Internal Server Error"});
        }
    }
}

export default new AdminController()