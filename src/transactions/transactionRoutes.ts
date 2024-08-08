import express from "express";
// import { checkUser } from "../utils/middleware";
import transactionController from "./transactionController";
const transactionRoutes = express.Router();

transactionRoutes.post("/",  transactionController.transaction );

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
