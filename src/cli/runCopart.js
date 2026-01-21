import { startCopartScheduler } from '../copart/scheduler.js';

startCopartScheduler().catch((error) => {
  console.error('Copart scheduler failed:', error);
  process.exit(1);
});

