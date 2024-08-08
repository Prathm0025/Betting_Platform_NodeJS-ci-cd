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
class UserController {
    sayHello(req, res, next) {
        res.status(200).json({ message: "Admin" });
    }
    login(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username, password are required");
            }
            try {
                const user = (yield userModel_1.default.findOne({ username })) || (yield playerModel_1.default.findOne({ username }));
                if (!user) {
                    throw (0, http_errors_1.default)(401, "User not found");
                }
                const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
                if (!isPasswordValid) {
                    throw (0, http_errors_1.default)(401, "Invalid password");
                }
                user.lastLogin = new Date();
                yield user.save();
                const token = jsonwebtoken_1.default.sign({ userId: user._id, username: user.username, role: user.role }, config_1.config.jwtSecret, { expiresIn: "24h" });
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
}
UserController.saltRounds = 10;
exports.default = new UserController();
