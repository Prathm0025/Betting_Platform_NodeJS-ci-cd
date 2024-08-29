// import { Worker, isMainThread, parentPort } from 'worker_threads';
// import os from 'os';
// import pLimit from 'p-limit';
// import { fileURLToPath } from 'url';
// import { dirname } from 'path';
// import { bets } from './bets.mjs';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// const WORKER_COUNT = os.cpus().length; 
// const BATCH_SIZE = 1000; // Increased batch size for efficiency
// const CONCURRENCY_LIMIT = 10; // Increased concurrency limit for optimized API calls

// class WorkerPool {
//   constructor(workerCount) {
//     this.workers = [];
//     this.tasks = [];
//     this.results = [];
//     this.completedTasks = 0;
//     this.workerCount = workerCount;
//     this.onCompletedCallback = null;

//     for (let i = 0; i < workerCount; i++) {
//       this.addWorker();
//     }
//   }

//   addWorker() {
//     const worker = new Worker(__filename);

//     worker.on('message', (result) => {
//       this.results.push(result);
//       this.completedTasks++;
//       if (this.tasks.length > 0) {
//         this.assignTask(worker);
//       }
//       if (this.completedTasks === this.tasks.length) {
//         this.handleCompletion();
//       }
//     });

//     worker.on('error', (err) => console.error('Worker error:', err));

//     this.workers.push(worker);
//   }

//   assignTask(worker) {
//     if (this.tasks.length > 0) {
//       const task = this.tasks.shift();
//       worker.postMessage(task);
//     }
//   }

//   addTask(task) {
//     this.tasks.push(task);
//     const availableWorker = this.workers.find(w => !w.isBusy);
//     if (availableWorker) {
//       this.assignTask(availableWorker);
//     }
//   }

//   onCompleted(callback) {
//     this.onCompletedCallback = callback;
//   }

//   handleCompletion() {
//     if (this.onCompletedCallback) {
//       this.onCompletedCallback(this.results);
//     }
//   }
// }

// if (isMainThread) {
//   const bets = loadBets(); // Load bets
//   const pool = new WorkerPool(WORKER_COUNT);

//   // Divide bets into chunks
//   for (let i = 0; i < bets.length; i += BATCH_SIZE) {
//     const batch = bets.slice(i, i + BATCH_SIZE);
//     pool.addTask(batch);
//   }

//   pool.onCompleted((results) => {
//     const finalResults = aggregateResults(results);
//     console.log('Final Results:', finalResults);
//   });

// } else {
//   parentPort.on('message', async (bets) => {
//     const betsByCategory = groupBetsByCategory(bets);

//     const limit = pLimit(CONCURRENCY_LIMIT);
//     const categoryPromises = Object.keys(betsByCategory).map(category =>
//       limit(() => makeApiCallForCategory(category, betsByCategory[category]))
//     );

//     try {
//       const results = await Promise.all(categoryPromises);
//       parentPort.postMessage(results);
//     } catch (error) {
//       console.error('Error in worker thread:', error);
//       parentPort.postMessage({ error: 'Failed to process bets' });
//     }
//   });
// }

// function groupBetsByCategory(bets) {
//   return bets.reduce((acc, bet) => {
//     if (!acc[bet.category]) {
//       acc[bet.category] = [];
//     }
//     acc[bet.category].push(bet);
//     return acc;
//   }, {});
// }

// async function makeApiCallForCategory(category, bets) {
//   // Simulate API call with delay
//   await new Promise(resolve => setTimeout(resolve, 300));

//   return {
//     category,
//     totalBets: bets.length,
//     success: true,
//     data: {
//       categoryName: category,
//       processedBets: bets.map(bet => ({ id: bet.id, processed: true })),
//     }
//   };
// }

// function loadBets() {
//   return bets; 
// }

// function aggregateResults(results) {
//   return results.flat();
// }

// export default new WorkerPool();