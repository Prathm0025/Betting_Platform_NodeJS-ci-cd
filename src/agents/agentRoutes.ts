import express from "express";
import agentController from "./agentController";
import { verifyRole } from "../utils/middleware";

const agentRoutes = express.Router();
agentRoutes.post("/", verifyRole(["admin"]), agentController.createAgent);
agentRoutes.get("/all", verifyRole(["admin"]), agentController.getAllAgents);
agentRoutes.get("/:id", verifyRole(["admin"]), agentController.getAgent);
agentRoutes.get("/players/:agentId", verifyRole(["admin", "agent"]), agentController.getPlayersUnderAgent);
agentRoutes.put("/:id", verifyRole(["admin"]), agentController.updateAgent);
agentRoutes.delete("/:id", verifyRole(["admin"]), agentController.deleteAgent);

export default agentRoutes;
