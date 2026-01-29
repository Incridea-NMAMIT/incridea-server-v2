import { Queue } from 'bullmq';

// Reuse the existing redis connection config from ioredis if possible, 
// but bullmq manages its own connections usually or takes connection options.
// Let's assume env has REDIS_URL or host/port.
// Looking at package.json, ioredis is used. 
// Assuming redis is at localhost:6379 based on typical setups or env.

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const receiptQueue = new Queue('receipt-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 times
    backoff: {
      type: 'exponential',
      delay: 5000, // Start retry after 5s, then 10s, 20s...
    },
    removeOnComplete: true, // Keep redis clean
    removeOnFail: false, // Keep failed jobs for inspection
  },
});

export async function addReceiptJob(data: any) {
  return await receiptQueue.add('generate-receipt', data);
}
