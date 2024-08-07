import express from "express";
import playerController from "./playerController";
import { verifyRole } from "../utils/middleware";

const playerRoutes = express.Router();

playerRoutes.get("/", playerController.sayHello)
playerRoutes.post("/create-player", verifyRole(['player']), playerController.createPlayer)


export default playerRoutes;