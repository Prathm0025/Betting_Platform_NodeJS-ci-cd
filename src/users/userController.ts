import { NextFunction, Request, Response } from "express";


class UserController {
    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Admin" })
    }

    login(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Login" })
    }
}

export default new UserController()