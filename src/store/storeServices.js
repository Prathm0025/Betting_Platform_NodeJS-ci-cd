"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class StoreService {
    constructor() {
    }
    selectBookmaker(bookmakers) {
        let bestBookmaker;
        let highestMargin = -Infinity;
        bookmakers === null || bookmakers === void 0 ? void 0 : bookmakers.forEach((bookmaker) => {
            var _a;
            (_a = bookmaker === null || bookmaker === void 0 ? void 0 : bookmaker.markets) === null || _a === void 0 ? void 0 : _a.forEach((market) => {
                var _a;
                let totalImpliedProbability = 0;
                (_a = market === null || market === void 0 ? void 0 : market.outcomes) === null || _a === void 0 ? void 0 : _a.forEach((outcome) => {
                    const impliedProbability = 1 / outcome.price;
                    totalImpliedProbability += impliedProbability;
                });
                // Calculate the bookmaker's margin for the current market
                const bookmakerMargin = (totalImpliedProbability - 1) * 100;
                // Update the highest margin and best bookmaker if needed
                if (bookmakerMargin > highestMargin) {
                    highestMargin = bookmakerMargin;
                    bestBookmaker = bookmaker;
                }
            });
        });
        return bestBookmaker;
    }
}
exports.default = StoreService;
