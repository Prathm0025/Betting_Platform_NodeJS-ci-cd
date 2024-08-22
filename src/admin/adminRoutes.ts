import express from "express";
import adminController from "./adminController";
import { verifyApiKey, verifyRole } from "../utils/middleware";

const adminRoutes = express.Router();

// adminRoutes.get("/:adminId", adminController.getAdminAgentsandAgentPlayers)
adminRoutes.post("/", adminController.createAdmin);
export default adminRoutes;
