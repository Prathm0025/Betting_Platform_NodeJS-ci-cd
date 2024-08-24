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
                const { username, password, captchaToken, captcha } = req.body;
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                console.log(sanitizedUsername, "username");
                const sanitizedPassword = (0, utils_1.sanitizeInput)(password);
                const sanitizedcaptachaToken = (0, utils_1.sanitizeInput)(captchaToken);
                const sanitizedCaptcha = (0, utils_1.sanitizeInput)(captcha);
                if (!sanitizedUsername || !sanitizedPassword || !sanitizedcaptachaToken || !sanitizedCaptcha) {
                    throw (0, http_errors_1.default)(400, "Username, password, CAPTCHA, and token are required");
                }
                const decoded = jsonwebtoken_1.default.verify(captchaToken, config_1.config.jwtSecret);
                const expectedCaptcha = captchaStore[decoded.captchaId];
                if (captcha !== expectedCaptcha) {
                    throw (0, http_errors_1.default)(400, "Invalid CAPTCHA");
                }
                delete captchaStore[decoded.captchaId];
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
                const token = jsonwebtoken_1.default.sign({ userId: user._id, username: user.username, role: user.role, credits: user.credits }, config_1.config.jwtSecret, { expiresIn: "24h" });
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
                console.log(user, "u");
                res.status(200).json(user);
            }
            catch (err) {
                next(err);
            }
        });
    }
    //GET SUMMARY(e.g. recent transactions and bets) FOR AGENT AND ADMIN DASHBOARD
    getSummary(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                // const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
                // const last30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
                const limitBets = parseInt(req.query.limitBets) || 4;
                const limitTransactions = parseInt(req.query.limitTransactions) || 10;
                const lastDays = parseInt(req.query.lastDays) || 30;
                const lastPeriodDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - lastDays);
                const [lastBets, lastTransactions, betTotals, transactionTotals, agentCounts, playerCounts] = yield Promise.all([
                    this.getLastBets(limitBets),
                    this.getLastTransactions(limitTransactions),
                    this.getBetTotals(startOfDay, lastPeriodDate),
                    this.getTransactionTotals(startOfDay, lastPeriodDate),
                    this.getAgentCounts(startOfDay, lastPeriodDate),
                    this.getPlayerCounts(startOfDay, lastPeriodDate),
                ]);
                const summary = {
                    lastBets,
                    lastTransactions,
                    betTotals: betTotals[0],
                    transactionTotals: transactionTotals[0],
                    agentCounts: agentCounts[0],
                    playerCounts: playerCounts[0],
                };
                res.status(200).json(summary);
            }
            catch (err) {
                console.error(err);
                res.status(500).send('Server error');
            }
        });
    }
    //RECENT BETS DEPENDING ON LIMIT (E.G. LIMIT =4 )
    getLastBets(limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return betModel_1.default.find().sort({ date: -1 }).limit(limit).populate('player', 'username _id').exec();
        });
    }
    getLastTransactions(limit) {
        return __awaiter(this, void 0, void 0, function* () {
            return transactionModel_1.default.find().sort({ date: -1 }).limit(limit).select('+senderModel +receiverModel')
                .populate({
                path: 'sender',
                select: 'username',
            })
                .populate({
                path: 'receiver',
                select: 'username',
            }).exec();
        });
    }
    //TOTAL BETS COUNT AND TOTAL BET AMOUNT FOR A PERIOD
    getBetTotals(startOfDay, lastPeriodDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return betModel_1.default.aggregate([
                {
                    $match: { updatedAt: { $gte: lastPeriodDate } },
                },
                {
                    $group: {
                        _id: null,
                        totalToday: { $sum: { $cond: [{ $gte: ['$date', startOfDay] }, '$amount', 0] } },
                        totalLastPeriod: { $sum: '$amount' },
                        countToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
                        countLastPeriod: { $sum: { $cond: [{ $gte: ['$createdAt', lastPeriodDate] }, 1, 0] } },
                    },
                },
            ]).exec();
        });
    }
    //TOTAL TRANSACTIOM COUNT AND TOTAL TRANSACTION AMOUNT FOR A PERIOD
    getTransactionTotals(startOfDay, lastPeriodDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return transactionModel_1.default.aggregate([
                {
                    $match: { date: { $gte: lastPeriodDate } },
                },
                {
                    $group: {
                        _id: null,
                        totalToday: { $sum: { $cond: [{ $gte: ['$date', startOfDay] }, '$amount', 0] } },
                        totalLastPeriod: { $sum: '$amount' },
                        countToday: { $sum: { $cond: [{ $gte: ['$date', startOfDay] }, 1, 0] } },
                        countLastPeriod: { $sum: { $cond: [{ $gte: ['$date', lastPeriodDate] }, 1, 0] } },
                    },
                },
            ]).exec();
        });
    }
    //AGENTS ADDED BETWEEN A PERIOD
    getAgentCounts(startOfDay, lastPeriodDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return userModel_1.default.aggregate([
                {
                    $match: { createdAt: { $gte: lastPeriodDate }, role: 'agent' },
                },
                {
                    $group: {
                        _id: null,
                        agentsToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
                        agentsLastPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
    //PLAYERS ADDED BETEWEEN A PERIOD
    getPlayerCounts(startOfDay, lastPeriodDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return playerModel_1.default.aggregate([
                {
                    $match: { createdAt: { $gte: lastPeriodDate } },
                },
                {
                    $group: {
                        _id: null,
                        playersToday: { $sum: { $cond: [{ $gte: ['$createdAt', startOfDay] }, 1, 0] } },
                        playersLastPeriod: { $sum: 1 },
                    },
                },
            ]).exec();
        });
    }
}
UserController.saltRounds = 10;
exports.default = new UserController();
