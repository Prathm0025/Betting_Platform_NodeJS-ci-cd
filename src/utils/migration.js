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
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyBet = migrateLegacyBet;
const betModel_1 = require("../bets/betModel");
function migrateLegacyBet(betDetail) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            if (betDetail.home_team && betDetail.away_team) {
                // console.log(`Migrating legacy bet with ID ${betDetail._id}...`);
                const newTeams = [
                    { name: (_a = betDetail.home_team) === null || _a === void 0 ? void 0 : _a.name, odds: (_b = betDetail.home_team) === null || _b === void 0 ? void 0 : _b.odds },
                    { name: (_c = betDetail.away_team) === null || _c === void 0 ? void 0 : _c.name, odds: (_d = betDetail.away_team) === null || _d === void 0 ? void 0 : _d.odds }
                ];
                let newBetOn;
                if (betDetail.bet_on === "home_team" && betDetail.home_team) {
                    newBetOn = {
                        name: betDetail.home_team.name,
                        odds: betDetail.home_team.odds
                    };
                }
                else if (betDetail.bet_on === "away_team" && betDetail.away_team) {
                    newBetOn = {
                        name: betDetail.away_team.name,
                        odds: betDetail.away_team.odds
                    };
                }
                else if (["Over", "Under"].includes(betDetail.bet_on)) {
                    newBetOn = {
                        name: betDetail.bet_on,
                        odds: 0
                    };
                }
                else {
                    console.error(`Invalid bet_on value: ${betDetail.bet_on}`);
                    return;
                }
                const newCategory = betDetail.market;
                const newBookmaker = betDetail.selected;
                const result = yield betModel_1.BetDetail.updateOne({ _id: betDetail._id }, {
                    $set: {
                        teams: newTeams,
                        bet_on: newBetOn,
                        category: newCategory,
                        bookmaker: newBookmaker,
                    },
                    $unset: { home_team: "", away_team: "", market: "", selected: "" }
                }, { new: true, strict: false });
                if (result) {
                    // console.log("Updated BetDetail:", result);
                }
                else {
                    // console.log("Failed to update BetDetail:", result);
                }
                // console.log(`Bet with ID ${betDetail._id} successfully migrated.`);
            }
            else {
                // console.log(`Bet with ID ${betDetail._id} is already fully migrated, skipping.`);
            }
        }
        catch (error) {
            // console.error(`Error migrating legacy bet with ID ${betDetail}:`, error);
        }
    });
}
