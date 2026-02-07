import { Queue } from 'bullmq';


const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const receiptQueue = new Queue('receipt-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3, 
    backoff: {
      type: 'exponential',
      delay: 5000, 
    },
    removeOnComplete: true, 
    removeOnFail: false, 
  },
});

export async function addReceiptJob(data: any) {
  return await receiptQueue.add('generate-receipt', data);
}
