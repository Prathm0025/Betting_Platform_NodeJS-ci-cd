import Agenda, { Job } from 'agenda';
import { Db } from 'mongodb';
import Bet from './betModel';
import { config } from '../config/config';
import { agenda } from '../config/db';
import { IBet } from './betsType';


class BetController {
    private agenda: Agenda | undefined;

    constructor() {
        if (!agenda) {
            console.error("Agenda is not initialized. Make sure the database is connected and agenda is initialized before using BetController.");
            return;
        }

        this.agenda = agenda;
        this.initializeAgenda();
    }

    private initializeAgenda() {
        this.agenda.define('lock bet', async (job: Job) => {
            await this.lockBet(job.attrs.data.betId);
        });

        this.agenda.define('process outcome', async (job: Job) => {
            await this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        });

        this.agenda.define('retry bet', async (job: Job) => {
            await this.processRetryQueue(job.attrs.data.betId);
        });


        this.agenda.start()
    }

    public async placeBet(betData: IBet) {
        const now = new Date();
        const commenceTime = new Date(betData.commence_time);

        if (commenceTime <= now) {
            console.log('Cannot place a bet after the match has started');
            return;
        }

        const bet = new Bet(betData);
        await bet.save();

        const delay = commenceTime.getTime() - now.getTime();
        this.agenda.schedule(new Date(Date.now() + delay), 'lock bet', { betId: bet._id.toString() })
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
            this.agenda.schedule('in 5 minutes', 'retry bet', { betId })
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
                this.agenda.schedule('in 5 minutes', 'retry bet', { betId });
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
                this.agenda.schedule('in 5 minutes', 'retry bet', { betId });
            }
        }
    }

    public async settleBet(betId: string, result: 'success' | 'fail') {
        this.agenda.now('process outcome', { betId, result });
    }
}

export default new BetController();