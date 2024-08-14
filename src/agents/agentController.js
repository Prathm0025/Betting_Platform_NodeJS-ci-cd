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
    //CREATE AN AGENT
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
                    throw (0, http_errors_1.default)(400, "username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, AgentController.saltRounds);
                const newAgent = new agentModel_1.default({
                    username,
                    password: hashedPassword,
                    createdBy: userId,
                });
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
                res
                    .status(201)
                    .json({ message: "Agent Created Succesfully", Agent: newAgent });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET SPECIFC AGENT
    getAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const agent = yield agentModel_1.default.findById(id);
                if (!agent) {
                    throw (0, http_errors_1.default)(404, "Agent not found");
                }
                res.status(200).json({ agent });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET ALL AGENTS
    getAllAgents(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("HERE");
                const agents = yield agentModel_1.default.find();
                res.status(200).json({ agents });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //UPDATE AN AGENT
    updateAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, username, password, status } = req.body;
            console.log(req.body);
            try {
                const updateData = Object.assign(Object.assign(Object.assign({}, (username && { username })), (password && {
                    password: yield bcrypt_1.default.hash(password, AgentController.saltRounds),
                })), (status && { status }));
                const updatedAgent = yield agentModel_1.default.findByIdAndUpdate(id, updateData, {
                    new: true,
                });
                if (!updatedAgent) {
                    console.log("HERE");
                    throw (0, http_errors_1.default)(404, "Agent not found");
                }
                res
                    .status(200)
                    .json({ message: "Agent updated successfully", agent: updatedAgent });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //DELETE AN AGENT
    deleteAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            try {
                const deletedAgent = yield agentModel_1.default.findByIdAndDelete(id);
                if (!deletedAgent) {
                    throw (0, http_errors_1.default)(404, "Agent not found");
                }
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const admin = yield adminModel_1.default.findById(userId);
                if (admin) {
                    admin.agents = admin.agents.filter((agentId) => agentId.toString() !== id);
                    yield admin.save();
                }
                res.status(200).json({ message: "Agent deleted successfully" });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET PLAYERS UNDER AN AGENT 
    getPlayersUnderAgent(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { agentId } = req.params;
            if (!agentId)
                throw (0, http_errors_1.default)(400, "Agent Id not Found");
            const agent = yield agentModel_1.default.findById({ _id: agentId }).populate("players");
            if (!agent)
                throw (0, http_errors_1.default)(404, "Agent Not Found");
            const playerUnderAgent = agent.players;
            if (playerUnderAgent.length === 0)
                res.status(200).json({ message: "No Players Under Agent" });
            res.status(200).json({ message: "Success!", players: playerUnderAgent });
        });
    }
}
AgentController.saltRounds = 10;
exports.default = new AgentController();
