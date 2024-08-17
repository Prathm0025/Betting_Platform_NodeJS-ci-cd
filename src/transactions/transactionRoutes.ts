import express from "express";
import transactionController from "./transactionController";
import { checkUser, verifyRole } from "../utils/middleware";
const transactionRoutes = express.Router();

transactionRoutes.post("/", verifyRole(["admin", "agent"]),  transactionController.transaction );
transactionRoutes.get("/all", verifyRole(["admin"]), transactionController.getAllTransactions);
transactionRoutes.get("/:agentId", verifyRole(["admin"]), transactionController.getSpecificAgentTransactions);
transactionRoutes.get("/all/:agentId", verifyRole([ "agent", "admin"]), transactionController.getAgentPlayerTransaction);
transactionRoutes.get("/all/by-username/:username", verifyRole(["agent", "admin"]), transactionController.getAgentPlayerTransaction)
transactionRoutes.get("/player/:playerId", checkUser, verifyRole(["admin", "agent"]), transactionController.getSpecificPlayerTransactions);
export default transactionRoutes;













// import express from "express";
// import { TransactionController } from "./transactionController";
// import { checkUser } from "../utils/middleware";

// const transactionController = new TransactionController();
// const transactionRoutes = express.Router();

// transactionRoutes.get("/all", checkUser, transactionController.getAllTransactions);
// transactionRoutes.get("/", checkUser, transactionController.getTransactions);
// transactionRoutes.get("/:subordinateId", checkUser, transactionController.getTransactionsBySubId);

// export default transactionRoutes;
