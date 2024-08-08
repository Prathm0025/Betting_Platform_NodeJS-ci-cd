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
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const agentModel_1 = __importDefault(require("../agents/agentModel"));
class PlayerController {
    sayHello(req, res, next) {
        res.status(200).json({ message: "Admin" });
    }
    createPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { username, password } = req.body;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username, password are required");
            }
            try {
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const existingUser = yield playerModel_1.default.findOne({ username: username });
                if (existingUser) {
                    return res.status(400).json({ message: "username already exists" });
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, PlayerController.saltRounds);
                const newUser = new playerModel_1.default({ username, password: hashedPassword, createdBy: userId });
                yield newUser.save();
                const agent = yield agentModel_1.default.findById(userId);
                if (agent) {
                    agent.players.push(newUser._id);
                    yield agent.save();
                }
                else {
                    throw (0, http_errors_1.default)(404, "Agent not found");
                }
                res.status(201).json({ message: "Player Created Succesfully", palyer: newUser });
            }
            catch (err) {
                console.log(err);
                res.status(500).json({ message: "Internal Server Error" });
            }
        });
    }
    getPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const player = yield playerModel_1.default.findById(id);
                if (!player) {
                    return next((0, http_errors_1.default)(404, "Player not found"));
                }
                res.status(200).json({ player });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    getAllPlayers(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const players = yield playerModel_1.default.find();
                res.status(200).json({ players });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    updatePlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { username, password, status } = req.body;
            try {
                const updateData = Object.assign(Object.assign(Object.assign({}, (username && { username })), (password && { password: yield bcrypt_1.default.hash(password, PlayerController.saltRounds) })), (status && { status }));
                const updatedPlayer = yield playerModel_1.default.findByIdAndUpdate(id, updateData, { new: true });
                if (!updatedPlayer) {
                    return next((0, http_errors_1.default)(404, "Player not found"));
                }
                res.status(200).json({ message: "Player updated successfully", player: updatedPlayer });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
    deletePlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            try {
                const deletedPlayer = yield playerModel_1.default.findByIdAndDelete(id);
                if (!deletedPlayer) {
                    return next((0, http_errors_1.default)(404, "Player not found"));
                }
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const agent = yield agentModel_1.default.findById(userId);
                if (agent) {
                    agent.players = agent.players.filter(playerId => playerId.toString() !== id);
                    yield agent.save();
                }
                res.status(200).json({ message: "Player deleted successfully" });
            }
            catch (err) {
                console.error(err);
                next((0, http_errors_1.default)(500, "Internal Server Error"));
            }
        });
    }
}
PlayerController.saltRounds = 10;
exports.default = new PlayerController();
