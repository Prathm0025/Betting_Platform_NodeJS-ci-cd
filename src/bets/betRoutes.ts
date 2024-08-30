import express from "express";
import betController from "./betController";
import { checkBetCommision, checkUser, verifyRole } from "../utils/middleware";

const betRoutes = express.Router();

betRoutes.get("/", verifyRole(["admin"]), betController.getAdminBets);

betRoutes.get("/:agentId", betController.getAgentBets);

// betRoutes.get("/all/:adminId",verifyRole(["admin"]), betController.getAdminAgentBets)

betRoutes.get("/:player/bets", betController.getBetForPlayer);
betRoutes.put("/:betId", checkBetCommision, betController.redeemPlayerBet);

export default betRoutes;
