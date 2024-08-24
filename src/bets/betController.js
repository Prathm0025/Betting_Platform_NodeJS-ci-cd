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
const betModel_1 = __importDefault(require("./betModel"));
const db_1 = require("../config/db");
const http_errors_1 = __importDefault(require("http-errors"));
const mongoose_1 = __importDefault(require("mongoose"));
const playerModel_1 = __importDefault(require("../players/playerModel"));
const storeController_1 = __importDefault(require("../store/storeController"));
const socket_1 = require("../socket/socket");
const userModel_1 = __importDefault(require("../users/userModel"));
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
    placeBet(playerRef, betData) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            console.log("BETDATA", betData);
            try {
                const oddsData = yield storeController_1.default.getOdds(betData.sport_key);
                // Find the game data matching the event_id
                const game = oddsData.live_games.find((g) => g.id === betData.event_id) ||
                    oddsData.upcoming_games.find((g) => g.id === betData.event_id) ||
                    oddsData.completed_games.find((g) => g.id === betData.event_id);
                if (game && game.completed) {
                    console.log("Cannot place a bet on a completed game");
                    throw new Error("Cannot place a bet on a completed game");
                }
                // Get the Player
                const player = yield playerModel_1.default.findById(playerRef.userId).session(session);
                if (!player) {
                    console.log("Player not found");
                    throw new Error("Player not found");
                }
                // check if the player has enought credits
                const betAmount = parseFloat(betData.amount.toString());
                if (player.credits < betAmount) {
                    throw new Error("Insufficient credits");
                }
                // Deduct the bet amount from player's credits
                player.credits -= betAmount;
                yield player.save({ session });
                const playerSocket = socket_1.users.get(player.username);
                if (playerSocket) {
                    playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                }
                // Calculate the possible winning amount
                const possibleWinningAmount = this.calculatePossibleWinning(betData);
                console.log("POSSIBLE WINNING AMOUNT: ", possibleWinningAmount);
                // Add the possibleWinningAmount to the betData
                const betDataWithWinning = Object.assign(Object.assign({}, betData), { possibleWinningAmount: possibleWinningAmount });
                // Save the bet with the session
                const bet = new betModel_1.default(betDataWithWinning);
                yield bet.save({ session });
                const now = new Date();
                const commenceTime = new Date(betData.commence_time);
                const delay = commenceTime.getTime() - now.getTime();
                const job = db_1.agenda.schedule(new Date(Date.now() + delay), "add bet to queue", { betId: bet._id.toString() });
                if (job) {
                    console.log(`Bet ${bet._id.toString()} scheduled successfully with a delay of ${delay}ms`);
                }
                else {
                    console.error(`Failed to schedule bet ${bet._id.toString()}`);
                    throw new Error("Failed to schedule bet");
                }
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
                console.log(agent);
                if (!agent)
                    throw (0, http_errors_1.default)(404, "Agent Not Found");
                const playerUnderAgent = agent.players;
                if (playerUnderAgent.length === 0)
                    res.status(200).json({ message: "No Players Under Agent" });
                const bets = yield betModel_1.default.find({
                    player: { $in: playerUnderAgent },
                }).populate("player", "username _id");
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
                const bets = yield betModel_1.default.find().populate("player", "username _id");
                console.log(bets, "bets");
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
                console.log(player, type);
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
                const playerBets = yield betModel_1.default.find(Object.assign({ player: playerDoc._id }, (status !== "all" && { status }))).populate("player", "username _id");
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
                const player = yield playerModel_1.default.findById({ _id: userId });
                if (!player) {
                    throw (0, http_errors_1.default)(404, "Player not found");
                }
                const bet = yield betModel_1.default.findById({ _id: betId });
                if (bet && bet.status === "pending") {
                    const selectedTeam = bet.bet_on === "home_team" ? bet.home_team.name : bet.away_team.name;
                    const oldOdds = bet.bet_on === "home_team" ? bet.home_team.odds : bet.away_team.odds;
                    const betAmount = bet.amount;
                    const currentData = yield storeController_1.default.getEventOdds(bet.sport_key, bet.event_id, bet.market, "us", bet.oddsFormat, "iso");
                    const currentOddsData = currentData.bookmakers.find((item) => item.key === bet.selected);
                    const newOdds = currentOddsData.markets[0].outcomes.find((item) => item.name === selectedTeam).price;
                    const newAmount = betAmount * ((newOdds - 1) / (oldOdds - 1));
                    player.credits += newAmount;
                    yield player.save();
                    const playerSocket = socket_1.users.get(player.username);
                    if (playerSocket) {
                        playerSocket.sendData({ type: "CREDITS", credits: player.credits });
                    }
                    bet.status = "redeem";
                    yield bet.save();
                    res.status(200).json({ message: "Bet Redeemed Successfully" });
                }
                else {
                    throw (0, http_errors_1.default)(400, "This bet can't be redeem since it is not pending!");
                }
            }
            catch (error) {
                next(error);
            }
        });
    }
}
exports.default = new BetController();
