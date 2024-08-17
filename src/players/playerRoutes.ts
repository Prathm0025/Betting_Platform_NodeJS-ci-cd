import express from "express";
import playerController from "./playerController";
import { verifyRole } from "../utils/middleware";

const playerRoutes = express.Router();

playerRoutes.post("/", verifyRole(['agent', 'admin']), playerController.createPlayer)
playerRoutes.get("/all", verifyRole(['agent', 'admin']), playerController.getAllPlayers)
playerRoutes.get("/:id?", verifyRole(["admin", "agent"]), playerController.getPlayer)
playerRoutes.get("/by-username/:username", verifyRole(["admin", "agent"]), playerController.getPlayer)
playerRoutes.put("/", verifyRole(['agent', 'admin']), playerController.updatePlayer)
playerRoutes.delete("/:id", verifyRole(['agent', 'admin']), playerController.deletePlayer)




export default playerRoutes;