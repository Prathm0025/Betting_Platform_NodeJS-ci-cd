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
exports.SuperadminController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_errors_1 = __importDefault(require("http-errors"));
const userModel_1 = require("../users/userModel");
class SuperadminController {
    constructor() {
        this.createSuperadmin = this.createSuperadmin.bind(this);
    }
    createSuperadmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { user } = req.body;
                if (!this.validateUserFields(user)) {
                    throw (0, http_errors_1.default)(400, "All required fields (name, username, password, role) must be provided");
                }
                const existingCompany = yield this.findSuperadminByUsername(user.username);
                if (existingCompany) {
                    throw (0, http_errors_1.default)(409, "Super admin already exists");
                }
                const hashedPassword = yield this.hashPassword(user.password);
                const superadmin = yield this.saveSuperadmin({
                    name: user.name,
                    username: user.username,
                    password: hashedPassword,
                    role: user.role,
                    credits: Infinity, // Assign infinite credits
                });
                res.status(201).json(superadmin);
            }
            catch (error) {
                next(error);
            }
        });
    }
    validateUserFields(user) {
        return user && user.name && user.username && user.password && user.role;
    }
    findSuperadminByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            return userModel_1.User.findOne({ username });
        });
    }
    hashPassword(password) {
        return __awaiter(this, void 0, void 0, function* () {
            return bcrypt_1.default.hash(password, 10);
        });
    }
    saveSuperadmin(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const superadmin = new userModel_1.User(userData);
            yield superadmin.save();
        });
    }
}
exports.SuperadminController = SuperadminController;
