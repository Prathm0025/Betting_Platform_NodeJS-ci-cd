import express from "express";
import playerController from "./playerController";
import { verifyRole } from "../utils/middleware";

const playerRoutes = express.Router();

playerRoutes.get("/", playerController.sayHello)
playerRoutes.post("/create-player", verifyRole(['agent']), playerController.createPlayer)
playerRoutes.get("/get-player/:id", verifyRole(['agent']), playerController.getPlayer)
playerRoutes.get("/get-all-players", verifyRole(['agent']), playerController.getAllPlayers)
playerRoutes.put("/update-player/:id", verifyRole(['agent']), playerController.updatePlayer)
playerRoutes.delete("/delete-player/:id", verifyRole(['agent']), playerController.deletePlayer)




export default playerRoutes;