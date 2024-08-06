import { NextFunction, Request, Response } from "express";

class AdminController {

    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Admin" })
    }
}

export default new AdminController()