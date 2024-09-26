"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const playerModel_1 = __importDefault(require("../players/playerModel"));
const userActivityModel_1 = __importStar(require("./userActivityModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const betModel_1 = __importDefault(require("../bets/betModel"));
const transactionModel_1 = __importDefault(require("../transactions/transactionModel"));
const mongoose_1 = __importDefault(require("mongoose"));
class UserActivityController {
    createActiviySession(username, startTime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const player = yield playerModel_1.default.findOne({ username: username });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player Not Found");
                }
                const newActivitySession = new userActivityModel_1.Activity({
                    startTime
                });
                const savedNewActivitySession = yield newActivitySession.save();
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let dailyActivity;
                dailyActivity = yield userActivityModel_1.default.findOne({
                    player: player._id,
                    date: today,
                });
                if (!dailyActivity) {
                    dailyActivity = new userActivityModel_1.default({
                        date: today,
                        player: player._id,
                    });
                    yield dailyActivity.save();
                }
                const updateDailyActivity = yield userActivityModel_1.default.findByIdAndUpdate(dailyActivity._id, {
                    $push: { actvity: savedNewActivitySession._id },
                }, { new: true, useFindAndModify: false });
                // console.log(savedNewActivitySession, dailyActivity);
            }
            catch (error) {
                console.error("Error creating activity:", error.message);
            }
        });
    }
    endSession(username, endTime) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const player = yield playerModel_1.default.findOne({ username: username });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player Not Found");
                }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dailyActivity = yield userActivityModel_1.default.findOne({
                    date: today,
                    player: player._id
                }).populate('actvity');
                if (!dailyActivity || !dailyActivity.actvity) {
                    throw (0, http_errors_1.default)(404, "No activity found for today.");
                }
                const latestActivitySession = dailyActivity.actvity.find((activity) => activity.endTime === null);
                if (!latestActivitySession) {
                    throw (0, http_errors_1.default)(404, "No active session to end.");
                }
                latestActivitySession.endTime = endTime;
                yield latestActivitySession.save();
                return { message: "Session ended successfully", endTime };
            }
            catch (error) {
                throw error;
            }
        });
    }
    getBetsAndTransactionsInActivitySession(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("red");
                const { startTime, endTime, playerId } = req.body;
                const betsAggregation = betModel_1.default.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: new Date(startTime), $lte: new Date(endTime) },
                            player: playerId, // Filter by playerId
                        },
                    },
                    {
                        $lookup: {
                            from: 'players',
                            localField: 'player',
                            foreignField: '_id',
                            as: 'playerDetails',
                        },
                    },
                    {
                        $unwind: '$playerDetails',
                    },
                    {
                        $lookup: {
                            from: 'betdetails',
                            localField: 'data',
                            foreignField: '_id',
                            as: 'betDetails',
                        },
                    },
                    {
                        $project: {
                            'playerDetails.username': 1,
                            'betDetails.commence_time': 1,
                            'betDetails.home_team.name': 1,
                            'betDetails.away_team.name': 1,
                            amount: 1,
                            status: 1,
                        },
                    },
                ]);
                const transactionsAggregation = transactionModel_1.default.aggregate([
                    {
                        $match: {
                            date: { $gte: new Date(startTime), $lte: new Date(endTime) },
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "sender",
                            foreignField: "_id",
                            as: "senderPlayer",
                        },
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverUser",
                        },
                    },
                    {
                        $lookup: {
                            from: "players",
                            localField: "receiver",
                            foreignField: "_id",
                            as: "receiverPlayer",
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$senderPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverUser",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $unwind: {
                            path: "$receiverPlayer",
                            preserveNullAndEmptyArrays: true,
                        },
                    },
                    {
                        $project: {
                            sender: {
                                $cond: {
                                    if: { $ifNull: ["$senderUser.username", false] },
                                    then: "$senderUser.username",
                                    else: "$senderPlayer.username",
                                },
                            },
                            receiver: {
                                $cond: {
                                    if: { $ifNull: ["$receiverUser.username", false] },
                                    then: "$receiverUser.username",
                                    else: "$receiverPlayer.username",
                                },
                            },
                            amount: 1,
                            type: 1,
                            date: 1,
                        },
                    }
                ]);
                const [bets, transactions] = yield Promise.all([betsAggregation, transactionsAggregation]);
                return res.status(200).json({ bets, transactions });
            }
            catch (error) {
            }
        });
    }
    ;
    getActivitiesByDate(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { date, playerId } = req.query;
                console.log(date, playerId);
                if (!date) {
                    throw (0, http_errors_1.default)(400, "Date query parameter is required");
                }
                if (!playerId) {
                    throw (0, http_errors_1.default)(400, "Player ID query parameter is required");
                }
                // Validate the date format
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                    throw (0, http_errors_1.default)(400, "Invalid date format");
                }
                const playerObjectId = new mongoose_1.default.Types.ObjectId(playerId);
                // Find activities by date and player
                const activities = yield userActivityModel_1.default.findOne({
                    date: parsedDate,
                    player: playerObjectId // Adjust this if playerId needs to be an ObjectId
                })
                    .populate({
                    path: 'actvity', // Check field name; assumed to be 'activity' based on context
                })
                    .populate({
                    path: 'player',
                    model: 'Player'
                });
                const populatedActivities = activities.actvity;
                return res.status(200).json(populatedActivities);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    getAllDailyActivitiesOfAPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { player } = req.params;
                const playerDetails = yield playerModel_1.default.findOne({ username: player });
                if (!playerDetails) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const getDailyActivitiesOfAPlayer = yield userActivityModel_1.default.find({ player: playerDetails._id });
                console.log(getDailyActivitiesOfAPlayer, playerDetails._id);
                return res.status(200).json(getDailyActivitiesOfAPlayer);
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = new UserActivityController();
