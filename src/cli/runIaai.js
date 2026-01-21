import { startIaaiScheduler } from '../iaai/scheduler.js';

startIaaiScheduler().catch((error) => {
  console.error('IAAI scheduler failed:', error);
  process.exit(1);
});

