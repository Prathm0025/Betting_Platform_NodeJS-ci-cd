"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginRateLimiter = exports.verifyApiKey = void 0;
exports.checkUser = checkUser;
exports.verifyRole = verifyRole;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const http_errors_1 = __importDefault(require("http-errors"));
const config_1 = require("../config/config");
const API_KEY = config_1.config.adminApiKey;
function checkUser(req, res, next) {
    var _a, _b;
    const cookie = (_b = (_a = req.headers.cookie) === null || _a === void 0 ? void 0 : _a.split("; ").find((row) => row.startsWith("userToken="))) === null || _b === void 0 ? void 0 : _b.split("=")[1];
    const authHeaders = req.headers.authorization;
    const token = cookie ||
        (authHeaders &&
            authHeaders.startsWith("Bearer") &&
            authHeaders.split(" ")[1]);
    //
    if (token) {
        jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret, (err, decoded) => {
            if (err) {
                if (err.name === "TokenExpiredError") {
                    console.error("Token expired:", err.message);
                    return next((0, http_errors_1.default)(401, "Token has expired"));
                }
                else {
                    console.error("Token verification failed:", err.message);
                    return next((0, http_errors_1.default)(401, "You are not authenticated"));
                }
            }
            else {
                const _req = req;
                _req.user = {
                    userId: decoded.userId,
                    username: decoded.username,
                    role: decoded.role,
                };
                next();
            }
        });
    }
    else {
        next((0, http_errors_1.default)(401, "Unauthorized: No role found in cookies"));
    }
}
const verifyApiKey = (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey) {
        return res.status(401).json({ message: "API key is missing" });
    }
    if (apiKey !== API_KEY) {
        return res.status(403).json({ message: "Invalid API key" });
    }
    next();
};
exports.verifyApiKey = verifyApiKey;
exports.loginRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts, please try again later.",
});
function verifyRole(requiredRoles) {
    return (req, res, next) => {
        var _a;
        const _req = req;
        const userRole = (_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.role;
        if (!userRole || !requiredRoles.includes(userRole)) {
            return next((0, http_errors_1.default)(403, "Forbidden: Insufficient role"));
        }
        next();
    };
}
