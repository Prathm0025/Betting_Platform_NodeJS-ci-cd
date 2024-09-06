import path from "path";
import { Worker } from "worker_threads";


export const startWorkers = () => {
    const waitingQueueWorker = new Worker(path.resolve(__dirname, "../workers/waitingQueueWorker.js"));

    const processingQueueWorker = new Worker(path.resolve(__dirname, "../workers/processingQueueWorker.js"));

    waitingQueueWorker.postMessage('start');
    processingQueueWorker.postMessage('start')

    waitingQueueWorker.on('message', (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`)
    });

    processingQueueWorker.on('message', (msg) => {
        console.log(`Message from Waiting Queue Worker : ${msg}`)
    });

    waitingQueueWorker.on('error', (error) => {
        console.error("Error in worker:", error);
    });

    processingQueueWorker.on('error', (error) => {
        console.error("Error in worker:", error);
    });

    waitingQueueWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        } else {
            console.log("Worker stopped successfully");
        }
    });

    processingQueueWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        } else {
            console.log("Worker stopped successfully");
        }
    });
}