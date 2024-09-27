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
const http_errors_1 = __importDefault(require("http-errors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const utils_1 = require("../utils/utils");
const userModel_1 = __importDefault(require("../users/userModel"));
const config_1 = require("../config/config");
const otp_1 = require("../utils/otp");
const mongoose_1 = __importDefault(require("mongoose"));
const cloudinary_1 = __importDefault(require("cloudinary"));
cloudinary_1.default.v2.config({
    cloud_name: config_1.config.cloud_name,
    api_key: config_1.config.api_key,
    api_secret: config_1.config.api_secret,
});
class AdminController {
    constructor() {
        this.requestOtp = this.requestOtp.bind(this);
    }
    requestOtp(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { user } = req.body;
            if (!user) {
                return next((0, http_errors_1.default)(400, "User details are required"));
            }
            const email = config_1.config.sentToMail;
            const otp = (0, otp_1.generateOtp)();
            // Store the OTP with and expiration time
            AdminController.otpStore.set(email, {
                otp,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            });
            console.log("OTP stored in memory: ", AdminController.otpStore);
            try {
                console.time("otp-sent");
                yield (0, otp_1.sendOtp)(email, otp);
                console.timeEnd("otp-sent");
                res.status(200).json({ message: "OTP sent successfully" });
            }
            catch (error) {
                console.error("Error sending OTP:", error);
                next((0, http_errors_1.default)(500, "Failed to send OTP"));
            }
        });
    }
    verifyOtpAndCreateAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { otp, user } = req.body;
            const receiverEmail = config_1.config.sentToMail;
            const storedOtp = AdminController.otpStore.get(receiverEmail);
            if (!otp || !user) {
                return next((0, http_errors_1.default)(400, "OTP and user details are required"));
            }
            if (!storedOtp || new Date() > storedOtp.expiresAt) {
                return next((0, http_errors_1.default)(400, "OTP expired"));
            }
            if (storedOtp.otp !== otp) {
                return next((0, http_errors_1.default)(400, "Invalid OTP"));
            }
            // Delete the OTP from the store
            AdminController.otpStore.delete(receiverEmail);
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                if (!user.username || !user.password) {
                    throw (0, http_errors_1.default)(400, "Username, password are required");
                }
                const sanitizedUsername = (0, utils_1.sanitizeInput)(user.username);
                const sanitizedPassword = (0, utils_1.sanitizeInput)(user.password);
                if (!sanitizedUsername || !sanitizedPassword) {
                    throw (0, http_errors_1.default)(400, "Username, password are required");
                }
                const existingAdmin = yield userModel_1.default.findOne({
                    username: sanitizedUsername,
                }).session(session);
                if (existingAdmin) {
                    throw (0, http_errors_1.default)(400, "Username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(sanitizedPassword, AdminController.saltRounds);
                const newAdmin = new userModel_1.default({
                    username: sanitizedUsername,
                    password: hashedPassword,
                });
                newAdmin.credits = Infinity;
                newAdmin.role = "admin";
                yield newAdmin.save({ session });
                yield session.commitTransaction();
                res
                    .status(201)
                    .json({ message: "Admin Created Succesfully", admin: newAdmin });
            }
            catch (error) {
                yield session.abortTransaction();
                next(error);
            }
        });
    }
}
AdminController.saltRounds = 10;
AdminController.otpStore = new Map();
exports.default = new AdminController();
