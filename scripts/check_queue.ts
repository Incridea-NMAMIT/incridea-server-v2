import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

const queue = new Queue('receipt-generation', { connection });

async function check() {
  console.log('Checking queue status...');
  const counts = await queue.getJobCounts();
  console.log('Job Counts:', counts);

  const failed = await queue.getFailed();
  if (failed.length > 0) {
    console.log('Failed Jobs:', failed.length);
    failed.forEach(job => {
        console.log(`Job ${job.id} failed: ${job.failedReason}`);
        console.log(`Data:`, job.data);
    });
  }

  const waiting = await queue.getWaiting();
  if (waiting.length > 0) {
      console.log('Waiting Jobs:', waiting.length);
      waiting.forEach(job => {
          console.log(`Job ${job.id} waiting. Data:`, job.data);
      });
  }
  
  const active = await queue.getActive();
  if (active.length > 0) {
      console.log('Active Jobs:', active.length);
      active.forEach(job => {
          console.log(`Job ${job.id} active. Data:`, job.data);
      });
  }

  process.exit(0);
}

check().catch(console.error);
