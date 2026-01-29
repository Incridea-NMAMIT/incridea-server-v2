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

    console.log(`Processing receipt job for Order ID: ${orderId}`);
    const io = getIO();

    try {
      io.to(`user-${userId}`).emit('generating_receipt');

      // 1. Generate PDF Buffer
      const receiptBuffer = await generateReceiptPdf(orderData, userData);
      if (!receiptBuffer) throw new Error('Failed to generate receipt PDF');

      const receiptFilename = `receipt_${orderId}.pdf`;

      // 2. Upload using Buffer
      const receiptUrl = await uploadReceipt({ buffer: receiptBuffer, name: receiptFilename });
      if (!receiptUrl) throw new Error('Failed to upload receipt');

      // 3. Update DB
      await prisma.paymentOrder.update({
        where: { orderId: orderId },
        data: { receipt: receiptUrl },
      });

      console.log(`Receipt completed for Order ID: ${orderId}`);
      io.to(`user-${userId}`).emit('receipt_generated', { receiptUrl });
      
      // 4. Send Email
      try {
        const paymentType = orderData.type === 'ACC_REGISTRATION' 
          ? 'Accommodation' 
          : orderData.type === 'EVENT_REGISTRATION' 
            ? 'Event Registration' 
            : 'Incridea'; // Default fallback

        const emailHtml = getPaymentReceiptEmailHtml(userData.name, paymentType);
        
        await sendEmail(
          userData.email,
          'Payment Receipt - Incridea',
          `Hello ${userData.name}, your payment receipt for ${paymentType} is attached.`,
          emailHtml,
          [
            {
              filename: receiptFilename,
              content: receiptBuffer, // Attach buffer directly
            },
          ]
        );
        console.log(`Receipt email sent to ${userData.email} for Order ID: ${orderId}`);
      } catch (emailError) {
        // Non-blocking error for email
        console.error(`Failed to send receipt email for Order ID: ${orderId}`, emailError);
      }

      return { receiptUrl };
    } catch (error) {
      console.error(`Receipt job failed for ${orderId}:`, error);
      throw error; // Triggers retry
    }
  },
  {
    connection,
    concurrency: 5, // Parallel processing
  }
);

console.log("Worker 'receipt-generation' started");

receiptWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed!`);
});

receiptWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`);
});
