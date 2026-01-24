import prisma from '../prisma/client';
import { Status, PaymentType } from '@prisma/client';

async function main() {
    console.log("Setting up test data for Cron Job...");

    // 1. Find or Create User
    let user = await prisma.user.findFirst({
        where: { email: 'cron_test@example.com' }
    });

    if (!user) {
        const college = await prisma.college.findFirst();
        user = await prisma.user.create({
            data: {
                name: "Cron Test User",
                email: "cron_test@example.com",
                phoneNumber: "8888888888",
                password: "hashed_dummy_pass",
                collegeId: college?.id || 1,
                category: 'EXTERNAL'
            }
        });
    }

    // 2. Create PaymentOrder with SUCCESS but NO receipt
    const mockOrderId = `cron_order_${Date.now()}`;
    console.log(`Creating Pending Receipt Order: ${mockOrderId}`);
    
    await prisma.paymentOrder.create({
        data: {
            orderId: mockOrderId,
            amount: 25000,
            collectedAmount: 250,
            status: Status.SUCCESS, // Vital: SUCCESS
            type: PaymentType.FEST_REGISTRATION,
            userId: user.id,
            receipt: null, // Vital: NULL
            paymentDataJson: {
                id: `pay_${Date.now()}`,
                amount: 25000,
                status: 'captured',
                method: 'upi'
            }
        }
    });

    console.log("Test data created. The Cron Job (if running) should pick this up in ~2 minutes.");
    console.log("Monitor the server logs for [ReceiptCron] messages.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
