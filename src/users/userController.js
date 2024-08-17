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
const svg_captcha_1 = __importDefault(require("svg-captcha"));
const uuid_1 = require("uuid");
const captchaStore = {};
class UserController {
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
                console.log(req.body);
                if (!username || !password || !captchaToken || !captcha) {
                    throw (0, http_errors_1.default)(400, "Username, password, CAPTCHA, and token are required");
                }
                const decoded = jsonwebtoken_1.default.verify(captchaToken, config_1.config.jwtSecret);
                const expectedCaptcha = captchaStore[decoded.captchaId];
                if (captcha !== expectedCaptcha) {
                    throw (0, http_errors_1.default)(400, "Invalid CAPTCHA");
                }
                delete captchaStore[decoded.captchaId];
                const user = (yield userModel_1.default.findOne({ username })) ||
                    (yield playerModel_1.default.findOne({ username }));
                if (!user) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const userStatus = user.status === "inactive";
                if (userStatus) {
                    throw (0, http_errors_1.default)(403, "You are Blocked!");
                }
                const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
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
                const user = (yield userModel_1.default.findById({ _id: userId })) ||
                    (yield playerModel_1.default.findById({ _id: userId }));
                if (!user)
                    throw (0, http_errors_1.default)(404, "User not found");
                res.status(200).json(user);
            }
            catch (err) {
                next(err);
            }
        });
    }
    getSummary(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
            }
            catch (error) {
            }
        });
    }
}
UserController.saltRounds = 10;
exports.default = new UserController();
