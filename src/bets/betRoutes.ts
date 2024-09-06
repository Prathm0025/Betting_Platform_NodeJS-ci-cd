import express from "express";
import betController from "./betController";
import { checkBetCommision, verifyRole } from "../utils/middleware";

const betRoutes = express.Router();

betRoutes.get("/", verifyRole(["admin"]), betController.getAdminBets);

betRoutes.get("/:agentId", betController.getAgentBets);


betRoutes.get("/:player/bets", betController.getBetForPlayer);
betRoutes.put("/:betId", checkBetCommision, betController.redeemPlayerBet);

export default betRoutes;
