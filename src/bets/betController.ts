import Agenda, { Job } from 'agenda';
import Bet from './betModel';
import { agenda } from '../config/db';
import { IBet } from './betsType';


class BetController {

    constructor() {
        if (!agenda) {
            console.error("Agenda is not initialized. Make sure the database is connected and agenda is initialized before using BetController.");
            return;
        }

        this.initializeAgenda();
    }


    private initializeAgenda() {
        agenda.define('lock bet', async (job: Job) => {
            await this.lockBet(job.attrs.data.betId);
        });

        agenda.define('process outcome', async (job: Job) => {
            await this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        });

        agenda.define('retry bet', async (job: Job) => {
            await this.processRetryQueue(job.attrs.data.betId);
        });


        agenda.start()
    }


    public async placeBet(betData: IBet) {
        const now = new Date();
        const commenceTime = new Date(betData.commence_time);

        if (commenceTime <= now) {
            console.log('Cannot place a bet after the match has started');
            return;
        }

        // Calculate the possible winning amount
        const possibleWinningAmount = this.calculatePossibleWinning(betData);
        console.log("POSSIBLE WINNING AMOUNT: ", possibleWinningAmount);

        // Add the possibleWinningAmount to the betData
        const betDataWithWinning = {
            ...betData,
            possibleWinningAmount: possibleWinningAmount
        };

        // Now you can proceed with saving the bet and scheduling the job
        const bet = new Bet(betDataWithWinning);
        await bet.save();

        const delay = commenceTime.getTime() - now.getTime();
        agenda.schedule(new Date(Date.now() + delay), 'lock bet', { betId: bet._id.toString() });
    }



    private calculatePossibleWinning(data: any) {
        const selectedTeam = data.bet_on === 'home_team' ? data.home_team : data.away_team;
        const oddsFormat = data.oddsFormat;
        const betAmount = parseFloat(data.amount.toString());


        let possibleWinningAmount = 0;

        switch (oddsFormat) {
            case "decimal":
                possibleWinningAmount = selectedTeam.odds * betAmount;
                break;

            case "american":
                if (selectedTeam.odds > 0) {
                    possibleWinningAmount = (selectedTeam.odds / 100) * betAmount + betAmount;
                } else {
                    possibleWinningAmount = (100 / Math.abs(selectedTeam.odds)) * betAmount + betAmount;
                }
                break;

            default:
                console.log("INVALID ODDS FORMAT")

        }

        return possibleWinningAmount
    }

    private async lockBet(betId: string) {
        const session = await Bet.startSession();
        session.startTransaction();

        try {
            const bet = await Bet.findById(betId).session(session);
            if (bet && bet.status !== 'locked') {
                bet.status = 'locked';
                await bet.save();
                await session.commitTransaction();
            }
        } catch (error) {
            await session.abortTransaction();
            agenda.schedule('in 5 minutes', 'retry bet', { betId })
        } finally {
            session.endSession()
        }
    }

    private async processOutcomeQueue(betId: string, result: 'success' | 'fail') {
        const bet = await Bet.findById(betId);

        if (bet) {
            try {
                bet.status = result;
                await bet.save();
            } catch (error) {
                agenda.schedule('in 5 minutes', 'retry bet', { betId });
            }
        }
    }

    private async processRetryQueue(betId: string) {
        const bet = await Bet.findById(betId);

        if (bet) {
            try {
                bet.retryCount += 1;
                if (bet.retryCount > 1) {
                    bet.status = 'fail';
                } else {
                    bet.status = 'retry'
                }
                await bet.save()
            } catch (error) {
                agenda.schedule('in 5 minutes', 'retry bet', { betId });
            }
        }
    }

    public async settleBet(betId: string, result: 'success' | 'fail') {
        agenda.now('process outcome', { betId, result });
    }
}

export default new BetController();