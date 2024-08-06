import express from "express";
import playerController from "./playerController";

const agentRoutes = express.Router();

agentRoutes.get("/", playerController.sayHello)

export default agentRoutes;