import express from "express";
import agentController from "./agentController";
import { verifyRole } from "../utils/middleware";

const agentRoutes = express.Router();
agentRoutes.get("/", agentController.sayHello)
agentRoutes.post("/create-agent", verifyRole(['admin']), agentController.createAgent)
agentRoutes.get("/get-agent/:id", verifyRole(['admin']), agentController.getAgent)
agentRoutes.get("/get-all-agents", verifyRole(['admin']), agentController.getAllAgents)
agentRoutes.put("/update-agent/:id", verifyRole(['admin']), agentController.updateAgent)
agentRoutes.delete("/delete-agent/:id", verifyRole(['admin']), agentController.deleteAgent)

export default agentRoutes;