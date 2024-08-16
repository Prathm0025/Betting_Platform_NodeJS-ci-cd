import express from "express";
import betController from "./betController";
import { checkUser, verifyRole } from "../utils/middleware";

const betRoutes = express.Router();

betRoutes.get("/:agentId", betController.getAgentBets)
betRoutes.get("/", verifyRole(["admin"]), betController.getAdminBets)
// betRoutes.get("/all/:adminId",verifyRole(["admin"]), betController.getAdminAgentBets)
betRoutes.get("/player/:userId", betController.getBetForPlayer)
export default betRoutes;