import { parentPort } from "worker_threads";

// HOW TO PROCESS H2H BETS
// REQUIRED : Scores
//      1. is match completed, if YES
//      2. check who won the match
//      3. get scores of the winning teams
//      4. get the player's betOn team
//      5. check if the player's betOn team is the winning team, if YES
//      6. get betOn team odds and stake from db
//      7. calculate the payout

// HOW TO CALCULATE PAYOUT
function calculatePayout(odd: number, stake: number) {
    let profit: number;
    let totalPayout: number;

    if (odd > 0) {
        profit = stake * odd / 100;
    } else {
        profit = (stake * 100) / Math.abs(odd);
    }

    totalPayout = stake + profit
}


async function checkBetsToProcess() {
    let betsData: any[] = [];
    const sports = new Set<string>();

}

async function startWorker() {

}

parentPort.on('message', (message) => {
    if (message === "start") {
        startWorker()
    }
})