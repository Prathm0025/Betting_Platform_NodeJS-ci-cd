"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userModel_1 = __importDefault(require("./userModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const config_1 = require("../config/config");
const utils_1 = require("../utils/utils");
const svg_captcha_1 = __importDefault(require("svg-captcha"));
const uuid_1 = require("uuid");
const transactionModel_1 = __importDefault(require("../transactions/transactionModel"));
const betModel_1 = __importDefault(require("../bets/betModel"));
const socket_1 = require("../socket/socket");
const captchaStore = {};
class UserController {
    constructor() {
        // Bind each method to 'this'
        this.getSummary = this.getSummary.bind(this);
        // Repeat for other methods as necessary
    }
    //TO GET CAPTCHA
    getCaptcha(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const captcha = svg_captcha_1.default.create();
                console.log(captcha.text);
                const captchaId = (0, uuid_1.v4)();
                captchaStore[captchaId] = captcha.text;
                const captchaToken = jsonwebtoken_1.default.sign({ captchaId }, config_1.config.jwtSecret, {
                    expiresIn: "5m",
                });
                res.status(200).json({ captcha: captcha.data, token: captchaToken });
            }
            catch (err) {
                next(err);
            }
        });
    }
    //LOGIN
    login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { username, password, captcha, captchaToken } = req.body;
                const { origin } = req.query;
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                const sanitizedPassword = (0, utils_1.sanitizeInput)(password);
                if (origin === "platform") {
                    if (!sanitizedUsername || !sanitizedPassword) {
                        throw (0, http_errors_1.default)(400, "Username and password are required");
                    }
                    if (socket_1.users.get(sanitizedUsername))
                        throw (0, http_errors_1.default)(400, "Your are already logged in from another device");
                }
                else if (origin === "crm") {
                    const sanitizedcaptachaToken = (0, utils_1.sanitizeInput)(captchaToken);
                    const sanitizedCaptcha = (0, utils_1.sanitizeInput)(captcha);
                    if (!sanitizedUsername ||
                        !sanitizedPassword ||
                        !sanitizedcaptachaToken ||
                        !sanitizedCaptcha) {
                        throw (0, http_errors_1.default)(400, "Username, password, CAPTCHA, and token are required");
                    }
                    const decoded = jsonwebtoken_1.default.verify(captchaToken, config_1.config.jwtSecret);
                    const expectedCaptcha = captchaStore[decoded.captchaId];
                    if (captcha !== expectedCaptcha) {
                        throw (0, http_errors_1.default)(400, "Invalid CAPTCHA");
                    }
                    delete captchaStore[decoded.captchaId];
                }
                else {
                    throw (0, http_errors_1.default)(404, "Not a valid origin");
                }
                const user = (yield userModel_1.default.findOne({ username: sanitizedUsername })) ||
                    (yield playerModel_1.default.findOne({ username: sanitizedUsername }));
                if (!user) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const userStatus = user.status === "inactive";
                if (userStatus) {
                    throw (0, http_errors_1.default)(403, "You are Blocked!");
                }
                const isPasswordValid = yield bcrypt_1.default.compare(sanitizedPassword, user.password);
                if (!isPasswordValid) {
                    throw (0, http_errors_1.default)(401, "Incoreect password");
                }
                user.lastLogin = new Date();
                yield user.save();
                const token = jsonwebtoken_1.default.sign({
                    userId: user._id,
                    username: user.username,
                    role: user.role,
                    credits: user.credits,
                }, config_1.config.jwtSecret, { expiresIn: "24h" });
                res.cookie("userToken", token, {
                    maxAge: 1000 * 60 * 60 * 24 * 7,
                    httpOnly: true,
                    sameSite: "none",
                });
                res.status(200).json({
                    message: "Login successful",
                    token: token,
                    role: user.role,
                });
            }
            catch (err) {
                console.log(err);
                next(err);
            }
        });
    }
    //CURRENT LOGGED IN USER
    getCurrentUser(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const _req = req;
                const { userId } = _req.user;
                if (!userId)
                    throw (0, http_errors_1.default)(400, "Invalid Request, Missing User");
                const user = (yield userModel_1.default.findById(userId).select("username role status credits")) ||
                    (yield playerModel_1.default.findById({ _id: userId }).select("username role status credits"));
                if (!user)
                    throw (0, http_errors_1.default)(404, "User not found");
                if (user.status === "inactive") {
                    throw (0, http_errors_1.default)(400, "You are blocked");
                }
                res.status(200).json(user);
            }
            catch (err) {
                next(err);
            }
        });
    }
    //GET SUMMARY(e.g. recent transactions and bets) FOR AGENT AND ADMIN DASHBOARD
    getSummary(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { period } = req.query;
                const user = yield userModel_1.default.findById(id);
                if (!user) {
                    throw (0, http_errors_1.default)(404, "User Not Found");
                }
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
                const endOfDay = new Date(startOfDay);
                endOfDay.setDate(startOfDay.getDate() + 1);
                const limitBets = parseInt(req.query.limitBets) || 4;
                const limitTransactions = parseInt(req.query.limitTransactions) || 10;
                let periodStart;
                let periodEnd;
                switch (period) {
                    case "week":
                        periodStart = startOfWeek;
                        periodEnd = today;
                        break;
                    case "month":
                        periodStart = startOfMonth;
                        periodEnd = today;
                        break;
                    case "today":
                    default:
                        periodStart = startOfDay;
                        periodEnd = endOfDay;
                        break;
                }
                const periodSummary = yield this.getPeriodSummary(periodStart, periodEnd, limitBets, limitTransactions, user);
                res.status(200).json(periodSummary);
            }
            catch (err) {
                console.error(err);
                next(err);
            }
        });
    }
    getPeriodSummary(startPeriod, endPeriod, limitBets, limitTransactions, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const [lastTransactions, transactionTotals, subordinateCounts, totalRecharged, totalRedeemed, playerCounts,] = yield Promise.all([
                this.getLastTransactions(limitTransactions, user),
                this.getTransactionTotals(startPeriod, endPeriod, user),
                this.getSubordinateCounts(startPeriod, endPeriod, user),
                this.getTotalRecharged(startPeriod, endPeriod, user),
                this.getTotalRedeemed(startPeriod, endPeriod, user),
                user.role === "agent" || user.role === "admin"
                    ? this.getPlayerCounts(startPeriod, endPeriod, user)
                    : undefined,
            ]);
            const result = {
                lastTransactions,
                transactionTotals: transactionTotals[0] || {},
                subordinateCounts: subordinateCounts[0] || {},
                totalRecharged: totalRecharged[0] || {},
                totalRedeemed: totalRedeemed[0] || {},
            };
            if (user.role === "agent" || user.role === "admin") {
                const lastBets = yield this.getLastBets(limitBets, user);
                result.lastBets = lastBets;
                result.betTotals = yield this.getBetTotals(startPeriod, endPeriod, user);
                result.playerCounts = playerCounts[0] || 0;
            }
            return result;
        });
    }
    getLastBets(limit, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = user.role === "admin" ? {} : { player: { $in: user.players } };
            return betModel_1.default.find(query)
                .sort({ date: -1 })
                .limit(limit)
                .populate("player", "username _id")
                .populate({
                path: "data",
                populate: {
                    path: "key",
                    select: "event_id sport_title commence_time status",
                },
            })
                .exec();
        });
    }
    getLastTransactions(limit, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = {};
            let userId = user._id;
            if (user.role !== "admin") {
                query.$or = [
                    { sender: userId },
                    { receiver: userId },
                    { sender: { $in: user.subordinates } },
                    { receiver: { $in: user.subordinates } },
                ];
            }
            return transactionModel_1.default.find(query)
                .sort({ date: -1 })
                .limit(limit)
                .select("+senderModel +receiverModel")
                .populate("sender", "username")
                .populate("receiver", "username")
                .exec();
        });
    }
    getBetTotals(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchCriteria = {
                updatedAt: { $gte: startPeriod, $lt: endPeriod },
            };
            if (user.role === "agent") {
                matchCriteria.player = { $in: user.players };
            }
            return betModel_1.default.aggregate([
                { $match: matchCriteria },
                {
                    $group: {
                        _id: null,
                        totalPeriod: { $sum: "$amount" },
                        countPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
    getTransactionTotals(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchCriteria = {
                date: { $gte: startPeriod, $lte: endPeriod },
            };
            console.log(startPeriod, endPeriod);
            let userId = user._id;
            if (user.role !== "admin") {
                matchCriteria.$or = [
                    { sender: { $in: user.subordinates } },
                    { receiver: { $in: user.subordinates } },
                    { sender: userId },
                    { receiver: userId },
                ];
            }
            return transactionModel_1.default.aggregate([
                { $match: matchCriteria },
                {
                    $group: {
                        _id: null,
                        totalPeriod: { $sum: "$amount" },
                        countPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
    getSubordinateCounts(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchCriteria = {
                createdAt: { $gte: startPeriod, $lt: endPeriod },
                role: { $in: ["distributor", "subdistributor", "agent"] },
            };
            if (user.role !== "admin") {
                matchCriteria.createdBy = user._id;
            }
            return userModel_1.default.aggregate([
                { $match: matchCriteria },
                {
                    $group: {
                        _id: null,
                        subordinatesPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
    getTotalRecharged(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            return transactionModel_1.default.aggregate([
                {
                    $match: {
                        type: "recharge",
                        date: { $gte: startPeriod, $lt: endPeriod },
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalRecharged: { $sum: "$amount" },
                    },
                },
            ]).exec();
        });
    }
    getTotalRedeemed(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            return transactionModel_1.default.aggregate([
                {
                    $match: { type: "redeem", date: { $gte: startPeriod, $lt: endPeriod } },
                },
                {
                    $group: {
                        _id: null,
                        totalRedeemed: { $sum: "$amount" },
                    },
                },
            ]).exec();
        });
    }
    getPlayerCounts(startPeriod, endPeriod, user) {
        return __awaiter(this, void 0, void 0, function* () {
            const matchCriteria = {
                createdAt: { $gte: startPeriod, $lt: endPeriod },
            };
            if (user.role === "agent") {
                matchCriteria.createdBy = user._id;
            }
            return playerModel_1.default.aggregate([
                { $match: matchCriteria },
                {
                    $group: {
                        _id: null,
                        playersPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
}
UserController.saltRounds = 10;
exports.default = new UserController();
