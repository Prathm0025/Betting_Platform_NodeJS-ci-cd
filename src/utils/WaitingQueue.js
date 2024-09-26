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
exports.removeFromWaitingQueue = removeFromWaitingQueue;
const redisclient_1 = require("../redisclient");
/* Function to remove a bet from the waiting queue
* @param bet - stringified object eg: {betID: "1234", commence_time: "2022-01-01T00:00:00.000Z"}
* @usage -         const data = {
         betId: detail._id.toString(),
         commence_time: new Date(detail.commence_time),
       }
       removeFromWaitingQueue(JSON.stringify(data));

* */
function removeFromWaitingQueue(bet) {
    return __awaiter(this, void 0, void 0, function* () {
        //here bet is a stringified object eg:{betID: "1234", commence_time: "2022-01-01T00:00:00.000Z"}
        /*
                const data = {
                  betId: detail._id.toString(),
                  commence_time: new Date(detail.commence_time),
                }
                removeFromWaitingQueue(JSON.stringify(data));
         * */
        yield redisclient_1.redisClient.zrem('waitingQueue', bet);
    });
}
