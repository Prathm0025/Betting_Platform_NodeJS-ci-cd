import express from "express";
import adminController from "./adminController";

const adminRoutes = express.Router();

adminRoutes.get("/", adminController.sayHello);
export default adminRoutes;