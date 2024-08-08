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
const adminModel_1 = __importDefault(require("./adminModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class AdminController {
    sayHello(req, res, next) {
        res.status(200).json({ message: "Admin" });
    }
    createAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username, password are required");
            }
            try {
                const existingAdmin = yield adminModel_1.default.findOne({ username: username });
                if (existingAdmin) {
                    return res.status(400).json({ message: "username already exists" });
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, AdminController.saltRounds);
                const newAdmin = new adminModel_1.default({ username, password: hashedPassword });
                newAdmin.credits = Infinity;
                newAdmin.role = "admin";
                yield newAdmin.save();
                res.status(201).json({ message: "Admin Created Succesfully", admin: newAdmin });
            }
            catch (err) {
                console.log(err);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
    }
}
AdminController.saltRounds = 10;
exports.default = new AdminController();
