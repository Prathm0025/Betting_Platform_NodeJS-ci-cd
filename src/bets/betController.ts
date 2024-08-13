import Agenda from 'agenda';
import { Db } from 'mongodb';
import Bet from './betModel';
import { config } from '../config/config';


class BetController {
    private agenda: Agenda;

    // constructor() {
    //     this.agenda = new Agenda({ db: { address: config.databaseUrl } });

    // }

    // Method to place a bet
    public async placeBet(betData: any) {
        const now = new Date();
        const commenceTime = new Date(betData.commence_time);

        // Check if the event has already started
        if (commenceTime <= now) {
            console.log('Cannot place a bet after the match has started.');
            return
        }

        const bet = new Bet(betData);
        await bet.save();

        const delay = commenceTime.getTime() - now.getTime();

        if (delay > 0) {
            // Schedule job to lock bet at commence time
            this.agenda.schedule(new Date(Date.now() + delay), 'lock bet', { betId: bet._id.toString() });
        } else {
            // This case should not happen because of the above check, but added for safety
            await this.lockBetImmediately(bet._id.toString());
        }
    }

    private initializeAgenda() {
        this.agenda.define('lock bet', async (job) => {
            await this.lockBet(job.attrs.data.betId);
        });

        this.agenda.define('process outcome', async (job) => {
            await this.processOutcomeQueue(job.attrs.data.betId, job.attrs.data.result);
        });

        this.agenda.define('retry bet', async (job) => {
            await this.processRetryQueue(job.attrs.data.betId);
        });

        this.agenda.start();
    }

    private async lockBetImmediately(betId: string) {
        await this.lockBet(betId);
    }
    private async lockBet(betId: string) {
        const bet = await Bet.findById(betId);
        if (bet) {
            try {
                // Lock the bet (e.g., prevent further modifications)
                bet.status = 'locked';
                await bet.save();
            } catch (error) {
                this.agenda.schedule('in 5 minutes', 'retry bet', { betId });
            }
        }
    }

    private async processOutcomeQueue(betId: string, result: 'success' | 'fail') {
        const bet = await Bet.findById(betId);

        if (bet) {
            try {
                // Process bet outcome based on external result
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
                bet.status = 'retry';
                await bet.save();
            } catch (error) {
                bet.retryCount += 1;
                if (bet.retryCount > 1) {
                    bet.status = 'fail';
                }
                await bet.save();
            }
        }
    }

    // Method to trigger outcome processing (e.g., from an external event)
    public async settleBet(betId: string, result: 'success' | 'fail') {
        this.agenda.now('process outcome', { betId, result });
    }


}

export default new BetController();