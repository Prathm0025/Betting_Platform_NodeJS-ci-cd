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
const agentModel_1 = __importDefault(require("./agentModel"));
const mongoose_1 = __importDefault(require("mongoose"));
const adminModel_1 = __importDefault(require("../admin/adminModel"));
class AgentController {
    sayHello(req, res, next) {
        res.status(200).json({ message: "Agent" });
    }
    createAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { username, password } = req.body;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username, password are required");
            }
            try {
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const existingAgent = yield agentModel_1.default.findOne({ username: username });
                if (existingAgent) {
                    return res.status(400).json({ message: "username already exists" });
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, AgentController.saltRounds);
                const newAgent = new agentModel_1.default({ username, password: hashedPassword, createdBy: userId });
                newAgent.role = "agent";
                yield newAgent.save();
                const admin = yield adminModel_1.default.findById(userId);
                if (admin) {
                    admin.agents.push(newAgent._id);
                    yield admin.save();
                }
                else {
                    throw (0, http_errors_1.default)(404, "Agent not found");
                }
                res.status(201).json({ message: "Agent Created Succesfully", Agent: newAgent });
            }
            catch (err) {
                console.log(err);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
    }
    getAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const agent = yield agentModel_1.default.findById(id);
                if (!agent) {
                    return next((0, http_errors_1.default)(404, "Agent not found"));
                }
                res.status(200).json({ agent });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    getAllAgents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agents = yield agentModel_1.default.find();
                res.status(200).json({ agents });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    updateAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { username, password, status } = req.body;
            try {
                const updateData = Object.assign(Object.assign(Object.assign({}, (username && { username })), (password && { password: yield bcrypt_1.default.hash(password, AgentController.saltRounds) })), (status && { status }));
                const updatedAgent = yield agentModel_1.default.findByIdAndUpdate(id, updateData, { new: true });
                if (!updatedAgent) {
                    return next((0, http_errors_1.default)(404, "Agent not found"));
                }
                res.status(200).json({ message: "Agent updated successfully", agent: updatedAgent });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    deleteAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            try {
                const deletedAgent = yield agentModel_1.default.findByIdAndDelete(id);
                if (!deletedAgent) {
                    return next((0, http_errors_1.default)(404, "Agent not found"));
                }
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const admin = yield adminModel_1.default.findById(userId);
                if (admin) {
                    admin.agents = admin.agents.filter(agentId => agentId.toString() !== id);
                    yield admin.save();
                }
                res.status(200).json({ message: "Agent deleted successfully" });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
}
AgentController.saltRounds = 10;
exports.default = new AgentController();
