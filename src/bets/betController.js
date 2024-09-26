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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const betModel_1 = __importStar(require("./betModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const storeController_1 = __importDefault(require("../store/storeController"));
const socket_1 = require("../socket/socket");
const userModel_1 = __importDefault(require("../users/userModel"));
const config_1 = require("../config/config");
const redisclient_1 = require("../redisclient");
const WaitingQueue_1 = require("../utils/WaitingQueue");
const ProcessingQueue_1 = require("../utils/ProcessingQueue");
class BetController {
    constructor() {
        this.initializeRedis();
    }
    initializeRedis() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.redisGetAsync = redisclient_1.redisClient.get.bind(redisclient_1.redisClient);
                this.redisSetAsync = redisclient_1.redisClient.set.bind(redisclient_1.redisClient);
            }
            catch (error) {
                console.error("Redis client connection error:", error);
                this.redisGetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
                this.redisSetAsync = () => __awaiter(this, void 0, void 0, function* () { return null; });
            }
        });
    }
    placeBet(playerRef, betDetails, amount, betType) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                // const tempBetId = betDetailIds.id
                // Check if the player is connected to the socket
                const playerSocket = socket_1.users.get(playerRef.username);
                if (!playerSocket) {
                    throw new Error("Player must be connected to the socket to place a bet");
                }
                // Find the player by ID and ensure they exist
                const player = yield playerModel_1.default.findById(playerRef.userId).session(session);
                if (!player) {
                    console.log("Player not found");
                    throw new Error("Player not found");
                }
                // Ensure the player has enough credits to place the bet
                if (player.credits < amount) {
                    throw new Error("Insufficient credits");
                }
                if (amount === 0) {
                    throw new Error("Betting amount can't be zero");
                }
                // for (const betDetailData of betDetails) {
                //   const cacheKey = `eventOdds:${betDetailData.sport_key}:${betDetailData.event_id}:${betDetailData.category}`;
                //   let cachedOddsData:any = await redisClient.get(cacheKey);
                //   if (!cachedOddsData) {
                //     const oddsData = await Store.getEventOdds(
                //       betDetailData.sport_key,
                //       betDetailData.event_id,
                //       betDetailData.category,
                //       'us',
                //       'decimal',
                //       'iso'
                //     );
                //     cachedOddsData = JSON.stringify(oddsData);
                //     await redisClient.set(cacheKey, cachedOddsData, 'EX', 30);
                //   }
                //   cachedOddsData = JSON.parse(cachedOddsData);
                //   console.log(cachedOddsData, "cached odds data");
                //   let cachedEvent = null;
                //   if (Array.isArray(cachedOddsData)) {
                //     cachedEvent = cachedOddsData.find(event => event.id === betDetailData.event_id);
                //   } else if (cachedOddsData && cachedOddsData.id === betDetailData.event_id) {
                //     cachedEvent = cachedOddsData;
                //   }
                //   if (!cachedEvent) {
                //     throw new Error(`Event with ID ${betDetailData.event_id} not found in cached data.`);
                //   }
                //   const cachedBookmaker = cachedEvent.bookmakers.find(bookmaker => bookmaker.key === betDetailData.bookmaker);
                //   if (!cachedBookmaker) {
                //     throw new Error(`Bookmaker ${betDetailData.bookmaker} not found for event`);
                //   }
                //   const cachedMarket = cachedBookmaker.markets.find(market => market.key === betDetailData.category);
                //   if (!cachedMarket) {
                //     throw new Error("Market not found in cached data");
                //   }
                //   const cachedOutcome = cachedMarket.outcomes.find(outcome => outcome.name === betDetailData.bet_on.name);
                //   console.log(cachedOutcome, "co");
                //   if (!cachedOutcome) {
                //     throw new Error(`Outcome for ${betDetailData.bet_on.name} not found in cached data`);
                //   }
                //   console.log(cachedOutcome.price, betDetailData.bet_on.odds, "cache ODDS");
                //   // Compare cached odds with submitted odds
                //   if (cachedOutcome.price !== betDetailData.bet_on.odds) {
                //     playerSocket.sendData({
                //       type: "ODDS_MISMATCH",
                //       message: `Odds for ${betDetailData.bet_on.name} have changed. Please refresh and try again.`
                //     });
                //     throw new Error(`Odds for ${betDetailData.bet_on.name} have changed.`);
                //   }
                // }
                for (const betDetailData of betDetails) {
                    const existingBetDetails = yield betModel_1.BetDetail.find({
                        event_id: betDetailData.event_id,
                        status: "pending",
                        category: betDetailData.category,
                    }).session(session);
                    if (existingBetDetails.length > 0) {
                        for (const data of existingBetDetails) {
                            const bet = yield betModel_1.default.findById(data.key).session(session);
                            if (!bet) {
                                throw new Error("Something went wrong");
                            }
                            const betPlayer = yield playerModel_1.default.findById(bet.player).session(session);
                        }
                    }
                }
                // Deduct the bet amount from the player's credits
                player.credits -= amount;
                yield player.save({ session });
                playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                const betId = new mongoose_1.default.Types.ObjectId();
                const betDetailIds = [];
                let cumulativeOdds = 1;
                for (const betDetailData of betDetails) {
                    const tempBetId = betDetailData.id;
                    const selectedOdds = betDetailData.bet_on.odds;
                    cumulativeOdds *= selectedOdds;
                    const betDetail = new betModel_1.BetDetail(Object.assign(Object.assign({}, betDetailData), { key: betId, status: "pending" }));
                    yield betDetail.save({ session });
                    betDetailIds.push(betDetail._id);
                    playerSocket.sendAlert({ type: "BET_PLACED", payload: { betId: tempBetId } });
                    playerSocket.removeBetFromSlip(tempBetId);
                    yield this.scheduleBetDetailJob(betDetail);
                }
                const possibleWinningAmount = cumulativeOdds * amount;
                // Create the Bet document with the manually generated _id
                const bet = new betModel_1.default({
                    _id: betId,
                    player: player._id,
                    data: betDetailIds,
                    amount,
                    possibleWinningAmount,
                    status: "pending",
                    retryCount: 0,
                    betType,
                });
                yield bet.save({ session });
                const playerBets = yield betModel_1.default.find({
                    player: player._id,
                })
                    .session(session)
                    .populate("player", "username _id")
                    .populate({
                    path: "data",
                    populate: {
                        path: "key",
                        select: "event_id sport_title commence_time status",
                    },
                });
                playerSocket.sendData({ type: "MYBETS", bets: playerBets });
                const selectedTeamName = betDetails[0].bet_on.name;
                const selectedOdds = betDetails[0].bet_on.odds;
                let playerResponseMessage;
                let agentResponseMessage;
                if (betType === "single") {
                    playerResponseMessage = `Placed a bet on ${selectedTeamName} with odds of ${selectedOdds}. Bet amount: $${amount}.`;
                    agentResponseMessage = `Player ${player.username} placed a bet of $${amount} on ${selectedTeamName} with odds of ${selectedOdds}. `;
                }
                else {
                    playerResponseMessage = `Combo bet placed successfully!. Bet Amount: $${amount}`;
                    agentResponseMessage = `Player ${player.username} placed a combo bet of $${amount}.`;
                }
                redisclient_1.redisClient.publish("bet-notifications", JSON.stringify({
                    type: "BET_PLACED",
                    player: {
                        _id: player._id.toString(),
                        username: player.username,
                    },
                    agent: player.createdBy.toString(),
                    betId: bet._id.toString(),
                    playerMessage: playerResponseMessage,
                    agentMessage: agentResponseMessage,
                }));
                // Commit the transaction
                yield session.commitTransaction();
                session.endSession();
                return bet;
            }
            catch (error) {
                // Rollback the transaction in case of error
                yield session.abortTransaction();
                session.endSession();
                console.error("Error placing bet:", error);
                playerRef.sendError(error.message);
            }
        });
    }
    scheduleBetDetailJob(betDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            const commence_time = new Date(betDetail.commence_time);
            const delay = commence_time.getTime() - Date.now();
            try {
                const timestamp = commence_time.getTime() / 1000;
                const data = {
                    betId: betDetail._id.toString(),
                    commence_time: new Date(betDetail.commence_time),
                };
                yield redisclient_1.redisClient.zadd("waitingQueue", timestamp.toString(), JSON.stringify(data));
                console.log(`BetDetail ${betDetail._id.toString()} scheduled successfully with a delay of ${delay}ms`);
            }
            catch (error) {
                console.error(`Failed to schedule bet detail ${betDetail._id.toString()}:`, error);
            }
        });
    }
    //GET BETS OF PLAYERS UNDER AN AGENT
    getAgentBets(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { agentId } = req.params;
                const { date } = req.query;
                if (!agentId)
                    throw (0, http_errors_1.default)(400, "Agent Id not Found");
                const agent = yield userModel_1.default.findById(agentId);
                if (!agent)
                    throw (0, http_errors_1.default)(404, "Agent Not Found");
                const query = {};
                if (date) {
                    const filterDate = new Date(date);
                    const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
                    const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
                    query.createdAt = { $gte: startOfDay, $lte: endOfDay };
                }
                const playerUnderAgent = agent.players;
                if (playerUnderAgent.length === 0)
                    return res.status(200).json({ message: "No Players Under Agent" });
                const bets = yield betModel_1.default.find(Object.assign({ player: { $in: playerUnderAgent } }, query))
                    .populate("player", "username _id")
                    .populate({
                    path: "data",
                    populate: {
                        path: "key",
                        select: "event_id sport_title commence_time status",
                    },
                });
                res.status(200).json(bets);
            }
            catch (error) {
                next(error);
            }
        });
    }
    //GET ALL BETS FOR ADMIN
    getAdminBets(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { date } = req.query;
                const query = {};
                if (date) {
                    const filterDate = new Date(date);
                    const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
                    const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
                    query.createdAt = { $gte: startOfDay, $lte: endOfDay };
                }
                const bets = yield betModel_1.default.find(query)
                    .sort({ createdAt: -1 })
                    .populate("player", "username _id")
                    .populate({
                    path: "data",
                    populate: {
                        path: "key",
                        select: "event_id sport_title commence_time status",
                    },
                });
                console.log(bets);
                res.status(200).json(bets);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    //GET BETS FOR A PLAYER
    getBetForPlayer(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { player } = req.params;
                const { type, status, date, search } = req.query;
                const query = {};
                if (date) {
                    const filterDate = new Date(date);
                    const startOfDay = new Date(filterDate.setHours(0, 0, 0, 0));
                    const endOfDay = new Date(filterDate.setHours(23, 59, 59, 999));
                    query.createdAt = { $gte: startOfDay, $lte: endOfDay };
                }
                let playerDoc;
                if (type === "id") {
                    playerDoc = yield playerModel_1.default.findById(player);
                    if (!playerDoc)
                        throw (0, http_errors_1.default)(404, "Player Not Found");
                }
                else if (type === "username") {
                    playerDoc = yield playerModel_1.default.findOne({ username: player });
                    if (!playerDoc)
                        throw (0, http_errors_1.default)(404, "Player Not Found with the provided username");
                }
                else {
                    throw (0, http_errors_1.default)(400, "User Id or Username not provided");
                }
                const playerBets = yield betModel_1.default.find(Object.assign(Object.assign(Object.assign({ player: playerDoc._id }, (status === "combo" || status === "all" ? {} : { status })), (status === "combo" && { betType: "combo" })), query))
                    .sort({ createdAt: -1 })
                    .populate("player", "username _id")
                    .populate({
                    path: "data",
                    populate: {
                        path: "key",
                        select: "event_id sport_title commence_time status",
                    },
                });
                res.status(200).json(playerBets);
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
    redeemBetInfo(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const _req = req;
                const { userId } = _req.user;
                const { betId } = req.params;
                let failed = false;
                const player = yield playerModel_1.default.findById({ _id: userId });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const betObjectId = new mongoose_1.default.Types.ObjectId(betId);
                const bet = yield betModel_1.default.findById(betObjectId);
                if (!bet) {
                    throw (0, http_errors_1.default)(404, "Bet not found");
                }
                if (bet.status !== "pending") {
                    throw (0, http_errors_1.default)(400, "Only bets with pending status can be redeemed!");
                }
                const betAmount = bet.amount;
                const allBets = bet === null || bet === void 0 ? void 0 : bet.data;
                const betDetailsArray = yield Promise.all(allBets.map((id) => betModel_1.BetDetail.findById(id)));
                let totalOldOdds = 1;
                let totalNewOdds = 1;
                for (const betDetails of betDetailsArray) {
                    const oldOdds = betDetails.bet_on.odds;
                    totalOldOdds *= oldOdds;
                    const currentData = yield storeController_1.default.getEventOdds(betDetails.sport_key, betDetails.event_id, betDetails.category, "us", betDetails.oddsFormat, "iso");
                    const currentBookmakerData = (_a = currentData === null || currentData === void 0 ? void 0 : currentData.bookmakers) === null || _a === void 0 ? void 0 : _a.find((item) => (item === null || item === void 0 ? void 0 : item.key) === betDetails.bookmaker);
                    //the earlier selected bookmaker is not available anymore
                    if (!currentBookmakerData) {
                        failed = true;
                        break;
                    }
                    else {
                        const marketDetails = (_b = currentBookmakerData === null || currentBookmakerData === void 0 ? void 0 : currentBookmakerData.markets) === null || _b === void 0 ? void 0 : _b.find((item) => item.key === betDetails.category);
                        const newOdds = marketDetails.outcomes.find((item) => {
                            if (betDetails.category !== "totals") {
                                return item.name === betDetails.bet_on.name;
                            }
                        }).price;
                        totalNewOdds *= newOdds;
                    }
                }
                if (failed) {
                    res.status(200).json({
                        message: "There was some error in processing this bet so, you will be refunded with the complete amount",
                        amount: betAmount,
                    });
                }
                else {
                    const amount = (totalNewOdds / totalOldOdds) * betAmount;
                    const finalPayout = amount - (parseInt(config_1.config.betCommission) / 100) * amount;
                    res
                        .status(200)
                        .json({ message: "Your final payout will be", amount: finalPayout });
                }
            }
            catch (error) {
                next(error);
            }
        });
    }
    //REDEEM PLAYER BET
    redeemPlayerBet(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log("HERE");
            try {
                const _req = req;
                const { userId } = _req.user;
                const { betId } = req.params;
                let failed = false;
                const player = yield playerModel_1.default.findById({ _id: userId });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const playerSocket = socket_1.users.get(player.username);
                const betObjectId = new mongoose_1.default.Types.ObjectId(betId);
                const bet = yield betModel_1.default.findById(betObjectId);
                if (!bet) {
                    throw (0, http_errors_1.default)(404, "Bet not found");
                }
                if (bet.status !== "pending") {
                    throw (0, http_errors_1.default)(400, "Only bets with pending status can be redeemed!");
                }
                const betAmount = bet.amount;
                const allBets = bet === null || bet === void 0 ? void 0 : bet.data;
                const betDetailsArray = yield Promise.all(allBets.map((id) => betModel_1.BetDetail.findById(id)));
                let totalOldOdds = 1;
                let totalNewOdds = 1;
                for (const betDetails of betDetailsArray) {
                    //need to remove from waiting list
                    const data = {
                        betId: betDetails._id.toString(),
                        commence_time: new Date(betDetails.commence_time),
                    };
                    (0, WaitingQueue_1.removeFromWaitingQueue)(JSON.stringify(data));
                    const oldOdds = betDetails.bet_on.odds;
                    totalOldOdds *= oldOdds;
                    const currentData = yield storeController_1.default.getEventOdds(betDetails.sport_key, betDetails.event_id, betDetails.category, "us", betDetails.oddsFormat, "iso");
                    const currentBookmakerData = (_a = currentData === null || currentData === void 0 ? void 0 : currentData.bookmakers) === null || _a === void 0 ? void 0 : _a.find((item) => (item === null || item === void 0 ? void 0 : item.key) === betDetails.bookmaker);
                    //the earlier selected bookmaker is not available anymore
                    if (!currentBookmakerData) {
                        console.log(failed);
                        failed = true;
                        break;
                    }
                    else {
                        console.log(currentBookmakerData, "DD");
                        const marketDetails = (_b = currentBookmakerData === null || currentBookmakerData === void 0 ? void 0 : currentBookmakerData.markets) === null || _b === void 0 ? void 0 : _b.find((item) => item.key === betDetails.category);
                        console.log(marketDetails, "MD");
                        const newOdds = marketDetails.outcomes.find((item) => {
                            return item.name === betDetails.bet_on.name;
                        }).price;
                        totalNewOdds *= newOdds;
                        betDetails.status = "redeem";
                        betDetails.isResolved = true;
                        yield betDetails.save();
                        bet.status = "redeem";
                        yield bet.save();
                    }
                }
                if (failed) {
                    for (const betDetails of betDetailsArray) {
                        betDetails.status = "failed";
                        yield betDetails.save();
                    }
                    player.credits += betAmount;
                    yield player.save();
                    bet.status = "failed";
                    yield bet.save();
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                    redisclient_1.redisClient.publish("bet-notifications", JSON.stringify({
                        type: "BET_REDEEMED_FAILED",
                        player: {
                            _id: player._id.toString(),
                            username: player.username,
                        },
                        agent: player.createdBy.toString(),
                        betId: bet._id.toString(),
                        playerMessage: ` Bet (ID: ${betId}) redeemed failed!`,
                        agentMessage: `A Player ${player.username} failed to redeemed a bet (ID: ${betId})`,
                    }));
                    throw (0, http_errors_1.default)(400, "Bet failed!");
                }
                else {
                    const amount = (totalNewOdds / totalOldOdds) * betAmount;
                    const finalPayout = amount - (parseInt(config_1.config.betCommission) / 100) * amount;
                    player.credits += finalPayout;
                    yield player.save();
                    bet.status = "redeem";
                    yield bet.save();
                    //send redeem notification
                    redisclient_1.redisClient.publish("bet-notifications", JSON.stringify({
                        type: "BET_REDEEMED",
                        player: {
                            _id: player._id.toString(),
                            username: player.username,
                        },
                        agent: player.createdBy.toString(),
                        betId: bet._id.toString(),
                        playerMessage: `A Bet (ID: ${betId}) redeemed successfully with a payout of ${finalPayout.toFixed(2)}!`,
                        agentMessage: `A Player ${player.username} redeemed a bet (ID: ${betId}) with a payout of ${finalPayout.toFixed(2)}`,
                    }));
                    res.status(200).json({ message: "Bet Redeemed Successfully" });
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                }
            }
            catch (error) {
                next(error);
            }
        });
    }
    // UPADTE OR RESOLVE BET
    resolveBet(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { betDetailId } = req.params;
                const { status } = req.body; // won - lost
                const updatedBetDetails = yield betModel_1.BetDetail.findByIdAndUpdate(betDetailId, {
                    status: status,
                }, { new: true });
                if (!updatedBetDetails) {
                    throw (0, http_errors_1.default)(404, "Bet detail not found");
                }
                const parentBetId = updatedBetDetails.key;
                const parentBet = yield betModel_1.default.findById(parentBetId);
                if (!parentBet) {
                    throw (0, http_errors_1.default)(404, "Parent bet not found");
                }
                const parentBetStatus = parentBet.status;
                if (parentBetStatus === "lost") {
                    return res.status(200).json({ message: "Bet detail Updated" });
                }
                if (status !== "won") {
                    parentBet.status = "lost";
                    yield parentBet.save();
                    return res.status(200).json({ message: "Bet detail Updated" });
                }
                const allBetDetails = yield betModel_1.BetDetail.find({
                    _id: { $in: parentBet.data },
                });
                const hasNotWon = allBetDetails.some((detail) => detail.status !== "won");
                if (!hasNotWon && parentBet.status !== "won") {
                    const playerId = parentBet.player;
                    const possibleWinningAmount = parentBet.possibleWinningAmount;
                    const player = yield playerModel_1.default.findById(playerId);
                    if (player) {
                        player.credits += possibleWinningAmount;
                        yield player.save();
                    }
                    parentBet.status = "won";
                    yield parentBet.save();
                    const playerSocket = socket_1.users.get(player.username);
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                }
                // remove from waiting queue on resolve
                allBetDetails.forEach((detail) => {
                    const data = {
                        betId: detail._id.toString(),
                        commence_time: new Date(detail.commence_time),
                    };
                    (0, WaitingQueue_1.removeFromWaitingQueue)(JSON.stringify(data));
                });
                return res.status(200).json({ message: "Bet detail status updated" });
            }
            catch (error) {
                next(error);
            }
        });
    }
    updateBet(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { betId, betDetails, betData } = req.body;
                console.log(JSON.stringify(req.body));
                if (!betId || !betData) {
                    throw (0, http_errors_1.default)(400, "Invalid Input");
                }
                const _a = betDetails, { detailId } = _a, updateData = __rest(_a, ["detailId"]);
                const existingBetDetails = yield betModel_1.BetDetail.findById(detailId);
                if (!existingBetDetails) {
                    throw (0, http_errors_1.default)(404, "Bet Detail Not found");
                }
                //Handling removing the bet from processing queue or waiting queue
                if (existingBetDetails.status === "pending" && betDetails.status !== "pending") {
                    const now = new Date().getTime();
                    const commenceTime = existingBetDetails.commence_time;
                    if (now >= new Date(commenceTime).getTime()) {
                        const data = {
                            betId: existingBetDetails._id.toString(),
                            commence_time: new Date(existingBetDetails.commence_time),
                        };
                        yield (0, WaitingQueue_1.removeFromWaitingQueue)(JSON.stringify(data));
                    }
                    else {
                        yield (0, ProcessingQueue_1.removeItem)(JSON.stringify(existingBetDetails));
                    }
                }
                const existingParentBet = yield betModel_1.default.findById(betId);
                if (!existingParentBet) {
                    throw (0, http_errors_1.default)(404, "Bet Not Found");
                }
                const session = yield mongoose_1.default.startSession();
                session.startTransaction();
                const newupdateData = Object.assign(Object.assign({}, updateData), { isResolved: true });
                yield betModel_1.BetDetail.findByIdAndUpdate(detailId, newupdateData, { new: true }).session(session);
                const updatedBet = yield betModel_1.default.findByIdAndUpdate(betId, betData, { new: true }).session(session);
                if (!updatedBet) {
                    yield session.abortTransaction();
                    session.endSession();
                    return res.status(404).json({ message: "Bet not found" });
                }
                yield session.commitTransaction();
                session.endSession();
                const parentBet = yield betModel_1.default.findById(updatedBet._id);
                const allBetDetails = yield betModel_1.BetDetail.find({ _id: { $in: parentBet.data } });
                const hasNotWon = allBetDetails.some((detail) => detail.status !== 'won');
                // const hasNotWonOrLost = allBetDetails.some(
                //   (detail) => detail.status !== 'won' && detail.status !== 'lost'
                // );
                let playerResponseMessage;
                let agentResponseMessage;
                const playerId = parentBet.player;
                const possibleWinningAmount = parentBet.possibleWinningAmount;
                const player = yield playerModel_1.default.findById(playerId);
                if (!hasNotWon && parentBet.status !== "won") {
                    if (player) {
                        player.credits += possibleWinningAmount;
                        yield player.save();
                    }
                    parentBet.status = "won";
                    parentBet.isResolved = true;
                    yield parentBet.save();
                    const playerSocket = socket_1.users.get(player.username);
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                    playerResponseMessage = `Bet Won!. Bet Amount: $${parentBet.amount}`;
                    agentResponseMessage = `Your Player ${player.username} has won a bet. Bet Amount: $${parentBet.amount}`;
                }
                else if (existingParentBet.status === "won" && hasNotWon) {
                    if (player) {
                        player.credits -= possibleWinningAmount;
                        yield player.save();
                    }
                    parentBet.status = "lost";
                    parentBet.isResolved = true;
                    yield parentBet.save();
                    const playerSocket = socket_1.users.get(player.username);
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                    playerResponseMessage = `Bet lost!. Bet Amount: $${parentBet.amount}`;
                    agentResponseMessage = `Your Player ${player.username} has lost a bet. Bet Amount: $${parentBet.amount}`;
                }
                else {
                    playerResponseMessage = `Bet ${parentBet.status}!. Bet Amount: $${parentBet.amount}`;
                    agentResponseMessage = `Your Player ${player.username}'s bet has  ${parentBet.status}. Bet Amount: $${parentBet.amount}`;
                }
                redisclient_1.redisClient.publish("bet-notifications", JSON.stringify({
                    type: "BET_RESULT",
                    player: {
                        _id: player._id.toString(),
                        username: player.username,
                    },
                    agent: player.createdBy.toString(),
                    betId: parentBet._id.toString(),
                    playerMessage: playerResponseMessage,
                    agentMessage: agentResponseMessage,
                }));
                res.status(200).json({ message: "Bet and BetDetails updated successfully", updatedBet });
            }
            catch (error) {
                console.log(error);
                next(error);
            }
        });
    }
}
exports.default = new BetController();
