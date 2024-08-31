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
const utils_1 = require("../utils/utils");
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userModel_1 = __importDefault(require("../users/userModel"));
const socket_1 = require("../socket/socket");
class PlayerController {
    //CREATE A PLAYER
    createPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { username, password } = req.body;
                const sanitizedUsername = (0, utils_1.sanitizeInput)(username);
                const sanitizedPassword = (0, utils_1.sanitizeInput)(password);
                if (!sanitizedUsername || !sanitizedPassword) {
                    throw (0, http_errors_1.default)(400, "Username and password are required");
                }
                const _req = req;
                const { userId, role } = _req.user;
                const creatorId = new mongoose_1.default.Types.ObjectId(userId);
                const creator = yield userModel_1.default.findById(creatorId);
                if (!creator) {
                    throw (0, http_errors_1.default)(404, "Creator not found");
                }
                const existingUser = yield playerModel_1.default.findOne({ username: username });
                if (existingUser) {
                    throw (0, http_errors_1.default)(400, "Username already exists");
                }
                const hashedPassword = yield bcrypt_1.default.hash(sanitizedPassword, PlayerController.saltRounds);
                const newUser = new playerModel_1.default({
                    username: sanitizedUsername,
                    password: hashedPassword,
                    createdBy: creatorId,
                });
                yield newUser.save();
                role === "admin"
                    ? creator.subordinates.push(newUser._id)
                    : creator.players.push(newUser._id);
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
            try {
                const { id } = req.params;
                const { username } = req.query;
                let player;
                if (id) {
                    player = yield playerModel_1.default.findById(id).select("-password");
                }
                else if (username) {
                    player = yield playerModel_1.default.findOne({ username }).select("-password");
                }
                else {
                    throw (0, http_errors_1.default)(400, "Player id or username not provided");
                }
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                res.status(200).json(player);
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
                res.status(200).json(players);
            }
            catch (error) {
                next(error);
            }
        });
    }
    //UPDATE PLAYER
    updatePlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password, status } = req.body;
            const { id: playerId } = req.params;
            try {
                const _req = req;
                const { userId, role } = _req.user;
                const sanitizedUsername = username ? (0, utils_1.sanitizeInput)(username) : undefined;
                const sanitizedPassword = password ? (0, utils_1.sanitizeInput)(password) : undefined;
                const sanitizedStatus = status ? (0, utils_1.sanitizeInput)(status) : undefined;
                const updateData = Object.assign(Object.assign(Object.assign({}, (sanitizedUsername && { username: sanitizedUsername })), (sanitizedPassword && {
                    password: yield bcrypt_1.default.hash(sanitizedPassword, PlayerController.saltRounds),
                })), (sanitizedStatus && { status: sanitizedStatus }));
                if (role === "agent") {
                    const agent = yield userModel_1.default.findById(userId);
                    if (!agent) {
                        throw (0, http_errors_1.default)(404, "Agent not found");
                    }
                    const playerExistsInAgent = agent.players.some((player) => player.toString() === playerId);
                    if (!playerExistsInAgent) {
                        throw (0, http_errors_1.default)(401, "You are not authorized to update this player");
                    }
                    const player = yield playerModel_1.default.findById(playerId);
                    if (!player) {
                        throw (0, http_errors_1.default)(404, "Player not found");
                    }
                }
                else if (role === "admin") {
                    const player = yield playerModel_1.default.findById(playerId);
                    if (!player) {
                        throw (0, http_errors_1.default)(404, "Player not found");
                    }
                }
                else {
                    throw (0, http_errors_1.default)(403, "You do not have permission to update players");
                }
                const updatedPlayer = yield playerModel_1.default.findByIdAndUpdate(playerId, updateData, {
                    new: true,
                });
                if (!updatedPlayer) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const playerSocket = socket_1.users.get(updatedPlayer === null || updatedPlayer === void 0 ? void 0 : updatedPlayer.username);
                if (playerSocket) {
                    playerSocket.sendMessage({ type: "STATUS", payload: updatedPlayer.status === "active" ? true : false, message: "" });
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
                const _req = req;
                const { userId: idUser, role } = _req.user;
                const userId = new mongoose_1.default.Types.ObjectId((_a = _req === null || _req === void 0 ? void 0 : _req.user) === null || _a === void 0 ? void 0 : _a.userId);
                const agent = yield userModel_1.default.findById(userId);
                const admin = yield userModel_1.default.findById(userId);
                if (!admin) {
                    throw (0, http_errors_1.default)(401, "You are not authorized");
                }
                if (role === "agent") {
                    const player = yield playerModel_1.default.findById(id);
                    const objectUserId = new mongoose_1.default.Schema.Types.ObjectId(idUser);
                    if (player.createdBy !== objectUserId) {
                        throw (0, http_errors_1.default)(401, "You Are Not Authorised!");
                    }
                }
                const deletedPlayer = yield playerModel_1.default.findByIdAndDelete(id);
                if (!deletedPlayer) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
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
