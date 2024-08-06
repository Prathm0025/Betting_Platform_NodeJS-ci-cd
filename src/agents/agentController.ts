import { NextFunction, Request, Response } from "express";

class AgentController {
    sayHello(req: Request, res: Response, next: NextFunction) {
        res.status(200).json({ message: "Admin" })
    }
}

export default new AgentController()