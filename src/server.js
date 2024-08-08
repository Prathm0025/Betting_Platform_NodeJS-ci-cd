"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const globalHandler_1 = __importDefault(require("./utils/globalHandler"));
const userRoutes_1 = __importDefault(require("./users/userRoutes"));
const adminRoutes_1 = __importDefault(require("./admin/adminRoutes"));
const agentRoutes_1 = __importDefault(require("./agents/agentRoutes"));
const middleware_1 = require("./utils/middleware");
const playerRoutes_1 = __importDefault(require("./players/playerRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
}));
app.use(express_1.default.json());
const server = (0, http_1.createServer)(app);
app.use("/api/auth", userRoutes_1.default);
app.use("/api/player", middleware_1.checkUser, playerRoutes_1.default);
app.use("/api/admin", middleware_1.checkUser, adminRoutes_1.default);
app.use("/api/agent", middleware_1.checkUser, agentRoutes_1.default);
// app.use("/api/superadmin", superadminRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/transactions", transactionRoutes);
// app.use("/api/superadmin", superadminRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/bets", betTransactionRoutes);
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
