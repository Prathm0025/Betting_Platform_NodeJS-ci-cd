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
const agentModel_1 = __importDefault(require("../agents/agentModel"));
class AdminController {
    //CREATE AN ADMIN
    createAdmin(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            try {
                if (!username || !password) {
                    throw (0, http_errors_1.default)(400, "Username, password are required");
                }
                const existingAdmin = yield adminModel_1.default.findOne({ username: username });
                if (existingAdmin) {
                    throw (0, http_errors_1.default)(400, "username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, AdminController.saltRounds);
                const newAdmin = new adminModel_1.default({ username, password: hashedPassword });
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
    //GET AGENT UNDER ADMIN AND PLAYERS UNDER THOSE AGENTS
    getAdminAgentsandAgentPlayers(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { adminId } = req.params;
                if (!adminId)
                    throw (0, http_errors_1.default)(400, "Admin Not Found");
                const agents = yield agentModel_1.default.find({ createdBy: adminId }).populate("players");
                if (agents.length === 0)
                    res.status(200).json({ message: "No Agents for Admin" });
                res.status(200).json({ message: "Success!", agents: agents });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
AdminController.saltRounds = 10;
exports.default = new AdminController();
