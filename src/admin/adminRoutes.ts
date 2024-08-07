import express from "express";
import adminController from "./adminController";

const adminRoutes = express.Router();

adminRoutes.post("/", adminController.createAdmin);
export default adminRoutes;