import { Worker, isMainThread, parentPort } from 'worker_threads';
import os from 'os';
import pLimit from 'p-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { bets } from './bets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORKER_COUNT = os.cpus().length; 
const BATCH_SIZE = 100; // Number of bets per batch
const CONCURRENCY_LIMIT = 5; // Limit concurrent API calls

// Worker Pool class to manage workers
class WorkerPool {
  constructor(workerCount) {
    this.workers = [];
    this.tasks = [];
    this.results = [];
    this.completedTasks = 0;
    this.workerCount = workerCount;
    this.onCompletedCallback = null;

    for (let i = 0; i < workerCount; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    
    const worker = new Worker(__filename);
    
    worker.on('message', (result) => {
      console.log(result, "results");
      
      this.results.push(result);
      this.completedTasks++;
      this.assignTask(worker);
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
    const availableWorker = this.workers.find(w => !w.isBusy);
    if (availableWorker) {
      console.log("WORKER IS AVAILABE");
      
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

if (isMainThread) {
  // Main thread: Manage workers and tasks
  const bets = loadBets(); // Load bets (can be from DB, file, etc.)
  const pool = new WorkerPool(WORKER_COUNT);
  
  // Divide bets into chunks
  for (let i = 0; i < bets.length; i += BATCH_SIZE) {
    const batch = bets.slice(i, i + BATCH_SIZE);
    pool.addTask(batch);
  }

  pool.onCompleted((results) => {
    // Aggregate results from all workers
    const finalResults = aggregateResults(results);
    // console.log('Final Results:', finalResults);
  });

} else {
  // Worker thread: Process bets
  parentPort.on('message', async (bets) => {
    // Step 1: Group bets by category
    const betsByCategory = groupBetsByCategory(bets);
    // console.log(betsByCategory, "category");
    
    // Step 2: Make optimized API calls for each category
    const limit = pLimit(CONCURRENCY_LIMIT);
    const categoryPromises = Object.keys(betsByCategory).map(category =>
      limit(() => makeApiCallForCategory(category, betsByCategory[category]))
    );

    // Step 3: Wait for all API calls to finish
    const results = await Promise.all(categoryPromises);
    // console.log(results, "results");
    
    parentPort.postMessage(results);
  });
}

// Function to group bets by category
function groupBetsByCategory(bets) {
  return bets.reduce((acc, bet) => {
    if (!acc[bet.category]) {
      acc[bet.category] = [];
    }
    acc[bet.category].push(bet);
    return acc;
  }, {});
}

async function makeApiCallForCategory(category, bets) {
  await new Promise(resolve => setTimeout(resolve, 300));

  return {
    category,
    totalBets: bets.length,
    success: true,
    data: {
      categoryName: category,
      processedBets: bets.map(bet => ({ id: bet.id, processed: true })),
    }
  };
}

// Function to load bets (could be from a file, database, etc.)
function loadBets() {
  // Placeholder for loading bets
  return bets; 
}

// Function to aggregate results from all workers
function aggregateResults(results) {
  // Placeholder for aggregation logic
  return results.flat(); // Example: Flattening the array of results
}