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
const betModel_1 = __importStar(require("./betModel"));
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const storeController_1 = __importDefault(require("../store/storeController"));
const socket_1 = require("../socket/socket");
const userModel_1 = __importDefault(require("../users/userModel"));
const config_1 = require("../config/config");
const redisclient_1 = require("../redisclient");
class BetController {
    placeBet(playerRef, betDetails, amount, betType) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
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
                //combo from same event and market
                // if (betType === "combo") {
                //   const combinedKeys = betDetails.map((bet) => `${bet.event_id}-${bet.market}`);
                //   const uniqueCombinedKeys = new Set(combinedKeys);
                //   if (combinedKeys.length !== uniqueCombinedKeys.size) {
                //     throw new Error("Invalid combo!");
                //   }
                // }
                // Check if the player already has a pending bet on the same team
                for (const betDetailData of betDetails) {
                    const existingBetDetails = yield betModel_1.BetDetail.find({
                        event_id: betDetailData.event_id,
                        status: "pending",
                        market: betDetailData.market,
                    }).session(session);
                    // Check if there are any existing bet details
                    if (existingBetDetails.length > 0) {
                        for (const data of existingBetDetails) {
                            const bet = yield betModel_1.default.findById(data.key).session(session);
                            if (!bet) {
                                throw new Error("Something went wrong");
                            }
                            const betPlayer = yield playerModel_1.default.findById(bet.player).session(session);
                            if (betPlayer._id.equals(player._id)) {
                                // Use `.equals` for MongoDB ObjectId comparison
                                if (data.bet_on === betDetailData.bet_on) {
                                    throw new Error(`You already have a pending bet on ${betDetailData.bet_on}.`);
                                }
                                else {
                                    throw new Error(`This is not a valid bet since the other bet is not yet resolved!`);
                                }
                            }
                        }
                    }
                }
                // Deduct the bet amount from the player's credits
                player.credits -= amount;
                yield player.save({ session });
                playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                // Manually generate the Bet's _id
                const betId = new mongoose_1.default.Types.ObjectId();
                const betDetailIds = [];
                let cumulativeOdds = 1; // Initialize cumulative odds
                // Loop through each BetDetail and create it
                for (const betDetailData of betDetails) {
                    // Calculate the selected team's odds
                    let selectedOdds;
                    switch (betDetailData.bet_on) {
                        case "home_team":
                            selectedOdds = betDetailData.home_team.odds;
                            break;
                        case "away_team":
                            selectedOdds = betDetailData.home_team.odds;
                            break;
                        case "Over":
                            selectedOdds = betDetailData.home_team.odds;
                            break;
                        case "Under":
                            selectedOdds = betDetailData.away_team.odds;
                            break;
                        default:
                            break;
                    }
                    cumulativeOdds *= selectedOdds;
                    // Create the BetDetail document
                    const betDetail = new betModel_1.BetDetail(Object.assign(Object.assign({}, betDetailData), { key: betId, status: "pending" }));
                    yield betDetail.save({ session });
                    betDetailIds.push(betDetail._id); // No need to cast, using mongoose.Types.ObjectId
                    // Schedule the job for this BetDetail based on its commence_time
                    yield this.scheduleBetDetailJob(betDetail);
                }
                // Calculate the possible winning amount
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
                let responseMessage;
                if (betType === "single") {
                    responseMessage = `Single bet on ${betDetails[0].bet_on === "home_team"
                        ? betDetails[0].home_team.name
                        : betDetails[0].away_team.name} placed successfully!`;
                }
                else {
                    responseMessage = "Combo bet placed sccessfully!";
                }
                playerSocket.sendMessage({
                    type: "BET",
                    data: responseMessage,
                });
                // Commit the transaction
                yield session.commitTransaction();
                session.endSession();
                return bet;
            }
            catch (error) {
                // Rollback the transaction in case of error
                yield session.abortTransaction();
                session.endSession();
                console.error("Error placing bet:", error.message);
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
    calculatePossibleWinning(data) {
        const selectedTeam = data.bet_on === "home_team" ? data.home_team : data.away_team;
        const oddsFormat = data.oddsFormat;
        const betAmount = parseFloat(data.amount.toString());
        let possibleWinningAmount = 0;
        switch (oddsFormat) {
            case "decimal":
                possibleWinningAmount = selectedTeam.odds * betAmount;
                break;
            case "american":
                if (selectedTeam.odds > 0) {
                    possibleWinningAmount =
                        (selectedTeam.odds / 100) * betAmount + betAmount;
                }
                else {
                    possibleWinningAmount =
                        (100 / Math.abs(selectedTeam.odds)) * betAmount + betAmount;
                }
                break;
            default:
                console.log("INVALID ODDS FORMAT");
        }
        return possibleWinningAmount;
    }
    //GET BETS OF PLAYERS UNDER AN AGENT
    getAgentBets(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { agentId } = req.params;
                if (!agentId)
                    throw (0, http_errors_1.default)(400, "Agent Id not Found");
                const agent = yield userModel_1.default.findById(agentId);
                if (!agent)
                    throw (0, http_errors_1.default)(404, "Agent Not Found");
                const playerUnderAgent = agent.players;
                if (playerUnderAgent.length === 0)
                    return res.status(200).json({ message: "No Players Under Agent" });
                const bets = yield betModel_1.default.find({
                    player: { $in: playerUnderAgent },
                })
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
                const bets = yield betModel_1.default.find()
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
                const { type, status } = req.query;
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
                const playerBets = yield betModel_1.default.find(Object.assign(Object.assign({ player: playerDoc._id }, (status === "combo" || status === "all" ? {} : { status })), (status === "combo" && { betType: "combo" })))
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
                console.log("PLAYERRRR", player);
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
                    let selectedTeam;
                    switch (betDetails.bet_on) {
                        case "home_team":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "away_team":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "Over":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "Under":
                            selectedTeam = betDetails.away_team;
                            break;
                        default:
                            break;
                    }
                    const oldOdds = selectedTeam.odds;
                    totalOldOdds *= oldOdds;
                    const currentData = yield storeController_1.default.getEventOdds(betDetails.sport_key, betDetails.event_id, betDetails.market, "us", betDetails.oddsFormat, "iso");
                    const currentBookmakerData = (_a = currentData === null || currentData === void 0 ? void 0 : currentData.bookmakers) === null || _a === void 0 ? void 0 : _a.find((item) => (item === null || item === void 0 ? void 0 : item.key) === betDetails.selected);
                    //the earlier selected bookmaker is not available anymore
                    if (!currentBookmakerData) {
                        failed = true;
                        break;
                    }
                    else {
                        const marketDetails = (_b = currentBookmakerData === null || currentBookmakerData === void 0 ? void 0 : currentBookmakerData.markets) === null || _b === void 0 ? void 0 : _b.find((item) => item.key === betDetails.market);
                        const newOdds = marketDetails.outcomes.find((item) => {
                            if (betDetails.market !== "totals") {
                                return item.name === selectedTeam.name;
                            }
                            else {
                                return item.name === betDetails.bet_on;
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
                    let selectedTeam;
                    switch (betDetails.bet_on) {
                        case "home_team":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "away_team":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "Over":
                            selectedTeam = betDetails.home_team;
                            break;
                        case "Under":
                            selectedTeam = betDetails.away_team;
                            break;
                        default:
                            break;
                    }
                    const oldOdds = selectedTeam.odds;
                    totalOldOdds *= oldOdds;
                    const currentData = yield storeController_1.default.getEventOdds(betDetails.sport_key, betDetails.event_id, betDetails.market, "us", betDetails.oddsFormat, "iso");
                    const currentBookmakerData = (_a = currentData === null || currentData === void 0 ? void 0 : currentData.bookmakers) === null || _a === void 0 ? void 0 : _a.find((item) => (item === null || item === void 0 ? void 0 : item.key) === betDetails.selected);
                    //the earlier selected bookmaker is not available anymore
                    if (!currentBookmakerData) {
                        failed = true;
                        break;
                    }
                    else {
                        const marketDetails = (_b = currentBookmakerData === null || currentBookmakerData === void 0 ? void 0 : currentBookmakerData.markets) === null || _b === void 0 ? void 0 : _b.find((item) => item.key === betDetails.market);
                        const newOdds = marketDetails.outcomes.find((item) => {
                            if (betDetails.market !== "totals") {
                                return item.name === selectedTeam.name;
                            }
                            else {
                                return item.name === betDetails.bet_on;
                            }
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
                    throw (0, http_errors_1.default)(400, "Bet failed!");
                }
                else {
                    const amount = (totalNewOdds / totalOldOdds) * betAmount;
                    const finalPayout = amount - (parseInt(config_1.config.betCommission) / 100) * amount;
                    player.credits += finalPayout;
                    yield player.save();
                    bet.status = "redeem";
                    yield bet.save();
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
                const { betId } = req.params;
                const { status } = req.body;
                const parentBet = yield betModel_1.default.findById(betId);
                if (!parentBet) {
                    throw (0, http_errors_1.default)(404, "Parent Bet not found!");
                }
                const { data: betDetailsIds, possibleWinningAmount, player: playerId } = parentBet;
                yield Promise.all(betDetailsIds.map((betDetailId) => betModel_1.BetDetail.findByIdAndUpdate(betDetailId, { status: status })));
                const updatedBet = yield betModel_1.default.findByIdAndUpdate(betId, { status: status }, { new: true });
                if (status === "won") {
                    const player = yield playerModel_1.default.findById(playerId);
                    if (!player) {
                        throw (0, http_errors_1.default)(404, "Player not found");
                    }
                    player.credits += possibleWinningAmount;
                    yield player.save();
                }
                return res.status(200).json({ message: "Bet resolved successfully", updatedBet });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = new BetController();
