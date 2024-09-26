"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const globalHandler_1 = __importDefault(require("./utils/globalHandler"));
const userRoutes_1 = __importDefault(require("./users/userRoutes"));
const adminRoutes_1 = __importDefault(require("./admin/adminRoutes"));
const subordinateRoutes_1 = __importDefault(require("./subordinates/subordinateRoutes"));
const middleware_1 = require("./utils/middleware");
const socket_io_1 = require("socket.io");
const socket_1 = __importDefault(require("./socket/socket"));
const playerRoutes_1 = __importDefault(require("./players/playerRoutes"));
const transactionRoutes_1 = __importDefault(require("./transactions/transactionRoutes"));
const storeRoutes_1 = __importDefault(require("./store/storeRoutes"));
const betRoutes_1 = __importDefault(require("./bets/betRoutes"));
const notificationRoutes_1 = __importDefault(require("./notifications/notificationRoutes"));
const userActivityRoutes_1 = __importDefault(require("./userActivity/userActivityRoutes"));
const bannerRoutes_1 = __importDefault(require("./banner/bannerRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    // origin: [`*.${config.hosted_url_cors}`],
    origin: "*",
}));
app.use(express_1.default.json());
const server = (0, http_1.createServer)(app);
app.use("/api/auth", userRoutes_1.default);
app.use("/api/players", middleware_1.checkUser, playerRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/subordinates", middleware_1.checkUser, subordinateRoutes_1.default);
app.use("/api/store", middleware_1.checkUser, storeRoutes_1.default);
app.use("/api/transactions", middleware_1.checkUser, transactionRoutes_1.default);
app.use("/api/bets", middleware_1.checkUser, betRoutes_1.default);
app.use("/api/userActivities", middleware_1.checkUser, userActivityRoutes_1.default);
app.use("/api/notifications", middleware_1.checkUser, notificationRoutes_1.default);
app.use("/api/banner", middleware_1.checkUser, bannerRoutes_1.default);
app.get("/", (req, res, next) => {
    const health = {
        uptime: process.uptime(),
        message: "OK",
        timestamp: new Date().toLocaleDateString(),
    };
    res.status(200).json(health);
});
app.use(express_1.default.static("src"));
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});
exports.io = io;
(0, socket_1.default)(io);
app.use(globalHandler_1.default);
exports.default = server;
