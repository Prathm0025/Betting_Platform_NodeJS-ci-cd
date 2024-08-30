import { parentPort } from 'worker_threads'
import betServices from '../bets/betServices'

export const startInterval = () => {
    console.log("---------INTERVAL THREAD STARTED---------");

    setInterval(async () => {
        const processingBetQueue = betServices.getPriorityQueueData();
        console.log("QUEUE DATA : ", processingBetQueue);
    }, 60000)
}

startInterval()