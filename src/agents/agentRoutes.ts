import express from "express";
import agentController from "./agentController";

const agentRoutes = express.Router();

agentRoutes.get("/", agentController.sayHello)

export default agentRoutes;