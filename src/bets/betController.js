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
const db_1 = require("../config/db");
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const storeController_1 = __importDefault(require("../store/storeController"));
const socket_1 = require("../socket/socket");
const userModel_1 = __importDefault(require("../users/userModel"));
const config_1 = require("../config/config");
class BetController {
    constructor() {
        if (!db_1.agenda) {
            console.error("Agenda is not initialized. Make sure the database is connected and agenda is initialized before using BetController.");
            return;
        }
        this.initializeAgenda();
    }
    initializeAgenda() {
        db_1.agenda.define("lock bet", (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.lockBet(job.attrs.data.betId);
        }));
        db_1.agenda.define("process outcome", (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        }));
        db_1.agenda.define("retry bet", (job) => __awaiter(this, void 0, void 0, function* () {
            yield this.processRetryQueue(job.attrs.data.betId);
        }));
        db_1.agenda.start();
    }
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
                // Check if the player already has a pending bet on the same team
                for (const betDetailData of betDetails) {
                    const existingBetDetail = yield betModel_1.BetDetail.findOne({
                        event_id: betDetailData.event_id,
                        bet_on: betDetailData.bet_on,
                        status: "pending",
                    }).session(session);
                    if (existingBetDetail) {
                        const bet = yield betModel_1.default.findById(existingBetDetail.key).session(session);
                        if (!bet) {
                            throw new Error("Something went wrong");
                        }
                        const betPlayer = yield playerModel_1.default.findById(bet.player).session(session);
                        if (betPlayer._id === player._id)
                            throw new Error(`You already have a pending bet on ${betDetailData.bet_on}.`);
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
                    const selectedOdds = betDetailData.bet_on === "home_team"
                        ? betDetailData.home_team.odds
                        : betDetailData.away_team.odds;
                    cumulativeOdds *= selectedOdds;
                    // Create the BetDetail document
                    const betDetail = new betModel_1.BetDetail(Object.assign(Object.assign({}, betDetailData), { key: betId, status: "pending" }));
                    yield betDetail.save({ session });
                    betDetailIds.push(betDetail._id); // No need to cast, using mongoose.Types.ObjectId
                    // Schedule the job for this BetDetail based on its commence_time
                    yield this.scheduleBetDetailJob(betDetail, session);
                }
                // Calculate the possible winning amount
                const possibleWinningAmount = cumulativeOdds * amount;
                // Create the Bet document with the manually generated _id
                const bet = new betModel_1.default({
                    _id: betId, // Use the manually generated _id
                    player: player._id,
                    data: betDetailIds, // Store all the BetDetail references
                    amount,
                    possibleWinningAmount,
                    status: "pending",
                    retryCount: 0,
                    betType,
                });
                yield bet.save({ session });
                //send myBets to user for disabling
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
    scheduleBetDetailJob(betDetail, session) {
        return __awaiter(this, void 0, void 0, function* () {
            const commence_time = new Date(betDetail.commence_time);
            const delay = commence_time.getTime() - Date.now();
            const job = yield db_1.agenda.schedule(new Date(Date.now() + delay), "add bet to queue", { betDetailId: betDetail._id.toString() });
            if (!job) {
                throw new Error(`Failed to schedule bet detail ${betDetail._id.toString()}`);
            }
            console.log(`BetDetail ${betDetail._id.toString()} scheduled successfully with a delay of ${delay}ms`);
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
    lockBet(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield betModel_1.default.startSession();
            session.startTransaction();
            try {
                const bet = yield betModel_1.default.findById(betId).session(session);
                if (bet && bet.status !== "locked") {
                    bet.status = "locked";
                    yield bet.save();
                    yield session.commitTransaction();
                }
            }
            catch (error) {
                yield session.abortTransaction();
                db_1.agenda.schedule("in 5 minutes", "retry bet", { betId });
            }
            finally {
                session.endSession();
            }
        });
    }
    processOutcomeQueue(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    bet.status = result;
                    yield bet.save();
                }
                catch (error) {
                    db_1.agenda.schedule("in 5 minutes", "retry bet", { betId });
                }
            }
        });
    }
    processRetryQueue(betId) {
        return __awaiter(this, void 0, void 0, function* () {
            const bet = yield betModel_1.default.findById(betId);
            if (bet) {
                try {
                    bet.retryCount += 1;
                    if (bet.retryCount > 1) {
                        bet.status = "lost";
                    }
                    else {
                        bet.status = "retry";
                    }
                    yield bet.save();
                }
                catch (error) {
                    db_1.agenda.schedule("in 5 minutes", "retry bet", { betId });
                }
            }
        });
    }
    settleBet(betId, result) {
        return __awaiter(this, void 0, void 0, function* () {
            db_1.agenda.now("process outcome", { betId, result });
        });
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
    //REDEEM PLAYER BET
    redeemPlayerBet(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const _req = req;
                const { userId } = _req.user;
                const { betId } = req.params;
                console.log(betId, "ye bheja");
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
                const allBets = bet.data;
                const betDetailsArray = yield Promise.all(allBets.map((id) => betModel_1.BetDetail.findById(id)));
                let totalOldOdds = 1;
                let totalNewOdds = 1;
                const betAmount = bet.amount;
                for (const betDetails of betDetailsArray) {
                    if (!betDetails)
                        continue;
                    if (betDetails.status !== "pending") {
                        throw (0, http_errors_1.default)(400, "Only bets with pending status can be redeemed!");
                    }
                    const selectedTeam = betDetails.bet_on === "home_team"
                        ? betDetails.home_team.name
                        : betDetails.away_team.name;
                    const oldOdds = betDetails.bet_on === "home_team"
                        ? betDetails.home_team.odds
                        : betDetails.away_team.odds;
                    const currentData = yield storeController_1.default.getEventOdds(betDetails.sport_key, betDetails.event_id, betDetails.market, "us", betDetails.oddsFormat, "iso");
                    const currentOddsData = currentData.bookmakers.find((item) => item.key === betDetails.selected);
                    totalOldOdds *= oldOdds;
                    const newOdds = currentOddsData.markets[0].outcomes.find((item) => item.name === selectedTeam).price;
                    totalNewOdds *= newOdds;
                    betDetails.status = "redeem";
                    yield betDetails.save();
                }
                console.log("OLD", totalOldOdds, "NEW", totalNewOdds);
                const amount = (totalNewOdds / totalOldOdds) * betAmount;
                const finalPayout = amount - (parseInt(config_1.config.betCommission) / 100) * amount;
                player.credits += finalPayout;
                yield player.save();
                bet.status = "redeem";
                yield bet.save();
                const playerSocket = socket_1.users.get(player.username);
                if (playerSocket) {
                    playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                }
                res.status(200).json({ message: "Bet Redeemed Successfully" });
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = new BetController();
