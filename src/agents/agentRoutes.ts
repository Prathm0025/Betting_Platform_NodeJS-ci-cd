import express from "express";
import agentController from "./agentController";
import { verifyRole } from "../utils/middleware";

const agentRoutes = express.Router();
agentRoutes.get("/", agentController.sayHello)
agentRoutes.post("/create-agent", verifyRole(['admin']), agentController.createAgent)


export default agentRoutes;