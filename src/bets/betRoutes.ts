import express from "express";
import betController from "./betController";
import { verifyRole } from "../utils/middleware";

const agentRoutes = express.Router();

agentRoutes.get("/:agentId", verifyRole(["agent", "admin"]), betController.getAgentBets)
agentRoutes.get("/:adminId", verifyRole(["admin"]), betController.getAdminBets)
agentRoutes.get("/all/:adminId",verifyRole(["admin"]), betController.getAdminAgentBets)

export default agentRoutes;