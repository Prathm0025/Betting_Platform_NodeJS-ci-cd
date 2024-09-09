import express from "express";
import betController from "./betController";
import { checkBetCommision, checkUser, verifyRole } from "../utils/middleware";

const betRoutes = express.Router();

betRoutes.get("/", verifyRole(["admin"]), betController.getAdminBets);

betRoutes.get(
  "/redeem/:betId",
  checkUser,
  checkBetCommision,
  betController.redeemBetInfo
);
betRoutes.get("/:agentId", betController.getAgentBets);
betRoutes.get("/:player/bets", betController.getBetForPlayer);
betRoutes.put(
  "/:betId",
  checkUser,
  checkBetCommision,
  betController.redeemPlayerBet
);

export default betRoutes;
