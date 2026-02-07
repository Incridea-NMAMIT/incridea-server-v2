import { Worker } from 'bullmq';
import prisma from '../prisma/client';
import { generateReceiptPdf } from '../utils/receipt_generator';
import { uploadReceipt } from '../utils/upload_receipt';
import { getIO } from '../socket';
import { sendEmail } from '../utils/mailer';
import { getPaymentReceiptEmailHtml } from '../templates/paymentReceiptEmail';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const receiptWorker = new Worker(
  'receipt-generation',
  async (job) => {
    const { orderData, userData, userId } = job.data;
    const orderId = orderData.orderId;

    console.log(`[ReceiptWorker] Processing job ${job.id} for Order ID: ${orderId}`);
    const io = getIO();

    try {
      if (userId) {
        io.to(`user-${userId}`).emit('generating_receipt');
      }

      console.log(`[ReceiptWorker] Generating PDF for ${orderId}...`);
      const receiptBuffer = await generateReceiptPdf(orderData, userData);
      if (!receiptBuffer) throw new Error('Failed to generate receipt PDF (empty buffer)');

      const receiptFilename = `receipt_${orderId}.pdf`;

      console.log(`[ReceiptWorker] Uploading PDF for ${orderId}...`);

      const uploadPromise = uploadReceipt({ buffer: receiptBuffer, name: receiptFilename });
      const timeoutPromise = new Promise<string | null>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out after 30s')), 30000)
      );

      const receiptUrl = await Promise.race([uploadPromise, timeoutPromise]);

      if (!receiptUrl) throw new Error('Failed to upload receipt (returned null)');

      console.log(`[ReceiptWorker] Upload successful: ${receiptUrl}`);

      await prisma.paymentOrder.update({
        where: { orderId: orderId },
        data: { receipt: receiptUrl },
      });

      console.log(`[ReceiptWorker] Receipt completed for Order ID: ${orderId}`);
      if (userId) {
        io.to(`user-${userId}`).emit('receipt_generated', { receiptUrl });
      }

      try {
        let paymentType = 'Incridea Fest Registration Fee';
        if (orderData.type === 'ACC_REGISTRATION') {
          paymentType = 'Accommodation Fee';
        } else if (orderData.type === 'MERCH_PAYMENT') {
          paymentType = 'Merchandise Order';
        }

        const emailHtml = getPaymentReceiptEmailHtml(userData.name, paymentType);

        await sendEmail(
          userData.email,
          'Payment Receipt - Incridea',
          `Hello ${userData.name}, your payment receipt for ${paymentType} is attached.`,
          emailHtml,
          [
            {
              filename: receiptFilename,
              content: receiptBuffer,
            },
          ]
        );
        console.log(`[ReceiptWorker] Email sent to ${userData.email} for Order ID: ${orderId}`);
      } catch (emailError) {
        console.error(`[ReceiptWorker] Failed to send receipt email for Order ID: ${orderId}`, emailError);
      }

      return { receiptUrl };
    } catch (error) {
      console.error(`[ReceiptWorker] Job failed for ${orderId}:`, error);
      throw error; 
    }
  },
  {
    connection,
    concurrency: 20, 
    lockDuration: 60000, 
  }
);

console.log("Worker 'receipt-generation' started");

receiptWorker.on('completed', (job) => {
  console.log(`[ReceiptWorker] Job ${job.id} completed!`);
});

receiptWorker.on('failed', (job, err) => {
  console.error(`[ReceiptWorker] Job ${job?.id} failed with ${err.message}`);
});
