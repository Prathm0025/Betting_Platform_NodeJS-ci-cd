

//DONT'T MODIFY THIS FILE---

import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';

class WorkerPool {
  private workers: Worker[] = [];
  private tasks: any[] = [];
  private results: any[] = [];
  private completedTasks = 0;
  private workerCount: number;
  private onCompletedCallback: ((results: any[]) => void) | null = null;

  constructor(workerCount = os.cpus().length) {
    this.workerCount = workerCount;
    this.initializeWorkers();
  }

  private initializeWorkers() {
    for (let i = 0; i < this.workerCount; i++) {
      this.addWorker();
    }
  }

  private addWorker() {
    const worker = new Worker(path.resolve(__dirname, './BetWorker.js'));

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

  private assignTask(worker: Worker) {
    if (this.tasks.length > 0) {
      const task = this.tasks.shift();
      worker.postMessage(task);
    }
  }

  public addTask(task: any) {
    this.tasks.push(task);
    const availableWorker = this.workers.find((w) => w.threadId === undefined);
    if (availableWorker) {
      this.assignTask(availableWorker);
    }
  }

  public onCompleted(callback: (results: any[]) => void) {
    this.onCompletedCallback = callback;
  }

  private handleCompletion() {
    if (this.onCompletedCallback) {
      this.onCompletedCallback(this.results);
    }
  }
}

export default WorkerPool;