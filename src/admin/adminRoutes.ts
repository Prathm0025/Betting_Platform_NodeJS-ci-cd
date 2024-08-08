import express from "express";
import adminController from "./adminController";
import { verifyApiKey } from "../utils/middleware";

const adminRoutes = express.Router();

adminRoutes.post("/", adminController.createAdmin);
export default adminRoutes;
