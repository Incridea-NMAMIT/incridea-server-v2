import { Client } from 'pg';
import { env } from '../utils/env';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import prisma from '../prisma/client';
import { sendEmail } from '../utils/mailer';
import { getPaymentReceiptEmailHtml } from '../templates/paymentReceiptEmail';
import { getWelcomeEmailHtml } from '../templates/welcomeEmail';
import { Category } from '@prisma/client';

const execPromise = util.promisify(exec);
const SCRIPT_PATH = path.join(__dirname, '../../scripts/receipt_generator.py');

let client: Client | null = null;

export async function startReceiptListener() {
    console.log('[ReceiptListener] Starting payment listener...');
    await connectWithRetry();
}

async function connectWithRetry() {
    try {
        if (client) {
            try {
                await client.end();
            } catch (err) {
                console.error('[ReceiptListener] Error closing existing client:', err);
            }
        }

        client = new Client({
            connectionString: env.databaseUrl,
        });

        await client.connect();

        // Listen for notifications
        await client.query('LISTEN payment_success');
        await client.query('LISTEN pid_generated');

        console.log('[ReceiptListener] Listening for payment_success and pid_generated notifications...');

        client.on('notification', async (msg) => {
            if (msg.channel === 'payment_success' && msg.payload) {
                const orderId = msg.payload;
                console.log(`[ReceiptListener] Received payment success notification for Order ID: ${orderId}`);
                
                await generateReceipt(orderId);
            } else if (msg.channel === 'pid_generated' && msg.payload) {
                const userId = msg.payload;
                console.log(`[ReceiptListener] Received PID generated notification for User ID: ${userId}`);
                await sendWelcomeEmail(Number(userId));
            }
        });

        client.on('error', (err) => {
            console.error('[ReceiptListener] Database connection error:', err);
            scheduleReconnect();
        });

        client.on('end', () => {
             console.warn('[ReceiptListener] Database connection ended unexpectedly.');
             scheduleReconnect();
        });

    } catch (error) {
        console.error('[ReceiptListener] Failed to start listener:', error);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    console.log('[ReceiptListener] Scheduling reconnection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
}

async function generateReceipt(orderId: string) {
    if (!orderId) return;

    console.log(`[ReceiptListener] Triggering receipt generation for ${orderId}`);
    try {
        // Call Python script
        const { stdout, stderr } = await execPromise(`python "${SCRIPT_PATH}" "${orderId}"`);
        
        if (stdout) console.log(`[ReceiptListener] [${orderId}] Output:`, stdout.trim());
        if (stderr) console.error(`[ReceiptListener] [${orderId}] Error Output:`, stderr.trim());

        // Parse receipt URL from stdout
        const match = stdout.match(/Database updated with receipt URL: (https:\/\/[^\s]+)/);
        const receiptUrl = match ? match[1] : null;

        if (receiptUrl) {
            console.log(`[ReceiptListener] Receipt generated: ${receiptUrl}. Sending email...`);
            
            // Fetch User Details using generic Prisma Client or import the one from project
            // Since we are in services folder, we should import the prisma client
            const order = await prisma.paymentOrder.findUnique({
                where: { orderId },
                include: { User: true }
            });

            if (order && order.User) {
                const emailHtml = getPaymentReceiptEmailHtml(order.User.name, order.type.replace('_', ' '));
                
                await sendEmail(
                    order.User.email,
                    `Payment Receipt - ${order.type.replace('_', ' ')}`,
                    `Please find attached the receipt for your ${order.type} payment.`,
                    emailHtml,
                    [
                        {
                            filename: `Receipt_${orderId}.pdf`,
                            path: receiptUrl
                        }
                    ]
                );
                console.log(`[ReceiptListener] Email sent to ${order.User.email}`);
            } else {
                console.error(`[ReceiptListener] Could not fetch order/user details for email: ${orderId}`);
            }

        } else {
             console.warn(`[ReceiptListener] Could not parse receipt URL from output for ${orderId}`);
        }

    } catch (error) {
        console.error(`[ReceiptListener] Failed to generate receipt for ${orderId}:`, error);
    }
}

async function sendWelcomeEmail(userId: number) {
    try {
        const user = await prisma.user.findUnique({
             where: { id: userId }
        });

        if (!user) {
            console.error(`[ReceiptListener] User not found for Welcome Email: ${userId}`);
            return;
        }

        const pidEntry = await prisma.pID.findUnique({
            where: { userId }
        });

        if (!pidEntry) {
             console.error(`[ReceiptListener] PID not found for User: ${userId}`);
             return;
        }

        const isAlumni = user.category === Category.ALUMNI;
        const emailHtml = getWelcomeEmailHtml(user.name, isAlumni ? undefined : pidEntry.pidCode);
        
        await sendEmail(user.email, 'Welcome to Incridea!', 'Welcome to Incridea!', emailHtml);
        console.log(`[ReceiptListener] Welcome email sent to ${user.email}`);

    } catch (error) {
        console.error(`[ReceiptListener] Failed to send Welcome Email to User ${userId}:`, error);
    }
}
