import express from "express";
import betController from "./betController";

const agentRoutes = express.Router();

agentRoutes.get("/", betController.sayHello)

export default agentRoutes;