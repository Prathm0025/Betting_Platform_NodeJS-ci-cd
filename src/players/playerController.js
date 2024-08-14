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
const adminModel_1 = __importDefault(require("../admin/adminModel"));
class PlayerController {
    //CREATE A PLAYER
    createPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            if (!username || !password) {
                throw (0, http_errors_1.default)(400, "Username, password are required");
            }
            try {
                const _req = req;
                const { userId, role } = _req.user;
                const creatorId = new mongoose_1.default.Types.ObjectId(userId);
                const creator = role === "admin"
                    ? yield adminModel_1.default.findById(creatorId)
                    : yield agentModel_1.default.findById(creatorId);
                if (!creator) {
                    throw (0, http_errors_1.default)(404, "Creator not found");
                }
                const existingUser = yield playerModel_1.default.findOne({ username: username });
                if (existingUser) {
                    throw (0, http_errors_1.default)(400, "Username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(password, PlayerController.saltRounds);
                const newUser = new playerModel_1.default({
                    username,
                    password: hashedPassword,
                    createdBy: creatorId,
                });
                yield newUser.save();
                creator.players.push(newUser._id);
                yield creator.save();
                res
                    .status(201)
                    .json({ message: "Player Created Succesfully", player: newUser });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET SPECIFIC PLAYER
    getPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const player = yield playerModel_1.default.findById(id);
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                res.status(200).json({ player });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET ALL PLAYERS 
    getAllPlayers(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const players = yield playerModel_1.default.find();
                res.status(200).json({ players });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //UPDATE PLAYER
    updatePlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, username, password, status } = req.body;
            try {
                const updateData = Object.assign(Object.assign(Object.assign({}, (username && { username })), (password && {
                    password: yield bcrypt_1.default.hash(password, PlayerController.saltRounds),
                })), (status && { status }));
                const updatedPlayer = yield playerModel_1.default.findByIdAndUpdate(id, updateData, {
                    new: true,
                });
                if (!updatedPlayer) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                res.status(200).json({
                    message: "Player updated successfully",
                    player: updatedPlayer,
                });
            }
            catch (error) {
                next(error);
            }
        });
    }
    //DELETE A PLAYER
    deletePlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id } = req.params;
            try {
                const deletedPlayer = yield playerModel_1.default.findByIdAndDelete(id);
                if (!deletedPlayer) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const _req = req;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const agent = yield agentModel_1.default.findById(userId);
                if (agent) {
                    agent.players = agent.players.filter((playerId) => playerId.toString() !== id);
                    yield agent.save();
                }
                res.status(200).json({ message: "Player deleted successfully" });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
PlayerController.saltRounds = 10;
exports.default = new PlayerController();
