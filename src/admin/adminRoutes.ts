import express from "express";
import adminController from "./adminController";
import { verifyApiKey } from "../utils/middleware";

const adminRoutes = express.Router();

adminRoutes.get("/", adminController.sayHello);
adminRoutes.post("/create-admin", verifyApiKey, adminController.createAdmin);
export default adminRoutes;