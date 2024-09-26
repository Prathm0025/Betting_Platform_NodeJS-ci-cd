"use strict";
//DONT'T MODIFY THIS FILE---
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
class WorkerPool {
    constructor(workerCount = os_1.default.cpus().length) {
        this.workers = [];
        this.tasks = [];
        this.results = [];
        this.completedTasks = 0;
        this.onCompletedCallback = null;
        this.workerCount = workerCount;
        this.initializeWorkers();
    }
    initializeWorkers() {
        for (let i = 0; i < this.workerCount; i++) {
            this.addWorker();
        }
    }
    addWorker() {
        const worker = new worker_threads_1.Worker(path_1.default.resolve(__dirname, './BetWorker.js'));
        worker.on('message', (result) => {
            this.results.push(result);
            this.completedTasks++;
            if (this.tasks.length > 0) {
                this.assignTask(worker);
            }
            if (this.completedTasks === this.tasks.length) {
                this.handleCompletion();
            }
        });
        worker.on('error', (err) => console.error('Worker error:', err));
        this.workers.push(worker);
    }
    assignTask(worker) {
        if (this.tasks.length > 0) {
            const task = this.tasks.shift();
            worker.postMessage(task);
        }
    }
    addTask(task) {
        this.tasks.push(task);
        const availableWorker = this.workers.find((w) => w.threadId === undefined);
        if (availableWorker) {
            this.assignTask(availableWorker);
        }
    }
    onCompleted(callback) {
        this.onCompletedCallback = callback;
    }
    handleCompletion() {
        if (this.onCompletedCallback) {
            this.onCompletedCallback(this.results);
        }
    }
}
exports.default = WorkerPool;
