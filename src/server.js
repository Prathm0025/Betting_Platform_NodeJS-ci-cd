"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const superadminRoutes_1 = __importDefault(require("./dashboard/superadmin/superadminRoutes"));
const globalHandler_1 = __importDefault(require("./utils/globalHandler"));
const userRoutes_1 = __importDefault(require("./dashboard/users/userRoutes"));
const transactionRoutes_1 = __importDefault(require("./dashboard/transactions/transactionRoutes"));
const betTransactionRoutes_1 = __importDefault(require("./dashboard/betTransactions/betTransactionRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
}));
app.use(express_1.default.json());
const server = (0, http_1.createServer)(app);
app.use("/api/superadmin", superadminRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/transactions", transactionRoutes_1.default);
app.use("/api/superadmin", superadminRoutes_1.default);
app.use("/api/users", userRoutes_1.default);
app.use("/api/bets", betTransactionRoutes_1.default);
app.get("/", (req, res, next) => {
    const health = {
        uptime: process.uptime(),
        message: "OK",
        timestamp: new Date().toLocaleDateString(),
    };
    res.status(200).json(health);
});
app.use(globalHandler_1.default);
exports.default = server;
