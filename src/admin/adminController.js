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
class AdminController {
    //CREATE AN ADMIN
    createAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            try {
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                const sanitizedPassword = (0, utils_1.sanitizeInput)(password);
                if (!sanitizedUsername || !sanitizedPassword) {
                    throw (0, http_errors_1.default)(400, "Username, password are required");
                }
                const existingAdmin = yield userModel_1.default.findOne({ username: username });
                if (existingAdmin) {
                    throw (0, http_errors_1.default)(400, "Username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(sanitizedPassword, AdminController.saltRounds);
                const newAdmin = new userModel_1.default({ sanitizedUsername, password: hashedPassword });
                newAdmin.credits = Infinity;
                newAdmin.role = "admin";
                yield newAdmin.save();
                res
                    .status(201)
                    .json({ message: "Admin Created Succesfully", admin: newAdmin });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
AdminController.saltRounds = 10;
exports.default = new AdminController();
