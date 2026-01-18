
import prisma from '../prisma/client';
import { Status, PaymentType, PaymentPurpose, PaymentStatus, PaymentMethod } from '@prisma/client';
import { generatePID } from '../services/pidService';
import { generateReceipt } from '../utils/receiptGenerator';

// --- MOCK CONSTANTS / TYPES ---

// --- HELPER FUNCTIONS FROM paymentController.ts ---

function createPaymentDataFromEntity(data: any, order: any): any {
    // Map JSON to Payment fields
    // Determine PaymentPurpose
    let purpose: any = PaymentPurpose.FEST_REGISTRATION; // Default based on user sample
    if (data.notes && data.notes.type) {
        if (data.notes.type === 'FEST_REGISTRATION') purpose = PaymentPurpose.FEST_REGISTRATION;
        else if (data.notes.type === 'EVENT_REGISTRATION') purpose = PaymentPurpose.EVENT_REGISTRATION;
        else if (data.notes.type === 'ACCOMMODATION' || data.notes.type === 'ACC_REGISTRATION') purpose = PaymentPurpose.ACCOMMODATION;
        else if (data.notes.type === 'MERCH') purpose = PaymentPurpose.MERCH;
    } else if (order.type === 'FEST_REGISTRATION') {
       purpose = PaymentPurpose.FEST_REGISTRATION;
    }

    // Map Status
    let status: any = PaymentStatus.CREATED;
    const s = data.status;
    if (s === 'created') status = PaymentStatus.CREATED;
    else if (s === 'authorized') status = PaymentStatus.AUTHORIZED;
    else if (s === 'captured') status = PaymentStatus.CAPTURED;
    else if (s === 'failed') status = PaymentStatus.FAILED;
    else if (s === 'refunded') status = PaymentStatus.REFUNDED;

    // Map Method
    let method: any = PaymentMethod.UPI; // Default or fallback
    const m = data.method;
    if (m === 'card') method = PaymentMethod.CARD;
    else if (m === 'netbanking') method = PaymentMethod.NETBANKING;
    else if (m === 'upi') method = PaymentMethod.UPI;
    else if (m === 'wallet') method = PaymentMethod.WALLET;
    else if (m === 'emi') method = PaymentMethod.EMI;

    return {
        gatewayPaymentId: data.id,
        gatewayOrderId: data.order_id,
        entity: data.entity,
        amount: typeof data.amount === 'string' ? parseInt(data.amount) : (data.amount || 0),
        fee: typeof data.fee === 'string' ? parseInt(data.fee) : data.fee,
        tax: typeof data.tax === 'string' ? parseInt(data.tax) : data.tax,
        amountRefunded: typeof data.amount_refunded === 'string' ? parseInt(data.amount_refunded) : (data.amount_refunded || 0),
        currency: data.currency || 'INR',
        status: status,
        captured: data.captured || false,
        refundStatus: data.refund_status,
        international: data.international || false,
        method: method,
        bankCode: data.bank,
        wallet: data.wallet,
        vpa: data.vpa,
        cardId: data.card_id,
        bankTransactionId: data.acquirer_data?.bank_transaction_id,
        email: data.email,
        contact: data.contact,
        purpose: purpose,
        registrationId: data.notes?.registrationId,
        userId: data.notes?.userId,
        errorCode: data.error_code,
        errorReason: data.error_reason,
        errorSource: data.error_source,
        errorStep: data.error_step,
        errorDescription: data.error_description,
    createdAt: data.created_at ? new Date(data.created_at * 1000) : new Date(),
    };
}

async function processSuccessfulPayment(paymentOrder: any, paymentEntity: any, paymentData: any) {
    // Update PaymentOrder and Create Payment
    await prisma.$transaction(async (tx) => {
        // Create Payment record
        // Check if already exists to avoid unique constraint error
        const existing = await tx.payment.findUnique({ where: { gatewayPaymentId: paymentEntity.id }});
        if (!existing) {
        await tx.payment.create({
            data: paymentData as any
        });
        }

        await tx.paymentOrder.update({
        where: { orderId: paymentOrder.orderId },
        data: {
            status: Status.SUCCESS,
            paymentDataJson: paymentEntity,
        } as any, // CASTING AS ANY
        })
    });
    
    console.log(`Payment successful for order ${paymentOrder.orderId}, User ID: ${paymentOrder.userId}`)

    // Generate PID if it's a FEST_REGISTRATION
    if (paymentOrder.type === PaymentType.FEST_REGISTRATION) {
        try {
            console.log(`Processing FEST_REGISTRATION for User ID: ${paymentOrder.userId}, Order ID: ${paymentOrder.orderId}`);

            const user = await prisma.user.findUnique({ where: { id: paymentOrder.userId } })
            
            if (!user) {
                 console.error('User not found for receipt and PID generation:', paymentOrder.userId);
                 return null;
            }

            // 1. Generate Receipt (Retry up to 3 times)
            let receiptUrl: string | null = null;
            let attempts = 0;
            const maxAttempts = 3;

            while (attempts < maxAttempts && !receiptUrl) {
                attempts++;
                console.log(`Generating receipt for Order ID: ${paymentOrder.orderId} (Attempt ${attempts}/${maxAttempts})`);
                try {
                    receiptUrl = await generateReceipt(paymentOrder as any, user, paymentData);
                    if (receiptUrl) {
                        console.log(`Receipt URL generated successfully on attempt ${attempts}: ${receiptUrl}`);
                    } else {
                        console.warn(`Attempt ${attempts} failed to generate receipt URL.`);
                        if (attempts < maxAttempts) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                } catch (err) {
                    console.error(`Error on receipt generation attempt ${attempts}:`, err);
                    if (attempts < maxAttempts) {
                         await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }

            if (receiptUrl) {
                // 2. Save Receipt URL
                const updatedOrder = await prisma.paymentOrder.update({
                    where: { orderId: paymentOrder.orderId },
                    data: { receipt: receiptUrl }
                })
                console.log(`Receipt saved to DB: ${updatedOrder.receipt}`)
            } else {
                console.error(`Failed to generate receipt after ${maxAttempts} attempts. Proceeding to PID generation without receipt.`);
            }

            // 3. Generate PID
            console.log(`Generating PID for User ID: ${paymentOrder.userId}...`);
            const pidContext = await generatePID(paymentOrder.userId, paymentOrder.orderId)
            console.log(`PID generated successfully: ${pidContext.pidCode}`)
            
            return pidContext.pidCode

        } catch (error) {
            console.error('Error during post-payment processing (Receipt/PID):', error)
            return null
        }
    }
    return null
}

// --- MAIN EXECUTION ---

async function main() {
    console.time('Total Execution Time');
    console.log("Starting testProcessPayment debug script...");

    // 1. Find or Create a Test User
    let user = await prisma.user.findFirst({
        where: { email: 'test_debug_payment@example.com' }
    });

    if (!user) {
        // Fallback to first user in DB if explicit test user doesn't exist, OR create one
        // Better to create one to ensure clean state or use existing if comfortable.
        // Let's see if there are ANY users.
        const anyUser = await prisma.user.findFirst();
        if (anyUser) {
            user = anyUser;
            console.log(`Using existing user: ${user.name} (${user.id})`);
        } else {
            console.log("No users found. Creating a test user...");
            // Need to satisfy schema constraints for User
            // Assuming College ID 1 exists, otherwise this might fail. 
            // We'll try common defaults.
            try {
               // Check if college exists
               let college = await prisma.college.findFirst();
               if (!college) {
                   college = await prisma.college.create({
                       data: { name: 'Test College', details: 'Test Details' }
                   });
               }

               user = await prisma.user.create({
                   data: {
                       name: "Debug User",
                       email: "test_debug_payment@example.com",
                       phoneNumber: "9999999999",
                       password: "hashed_dummy_pass",
                       collegeId: college.id,
                       category: 'EXTERNAL'
                   }
               });
               console.log(`Created test user: ${user.name} (${user.id})`);
            } catch (e) {
                console.error("Failed to create test user:", e);
                return;
            }
        }
    }

    // 2. Prepare Mock Data
    const mockOrderId = `order_${Date.now()}`;
    const mockPaymentId = `pay_${Date.now()}`;
    const amountInRupees = 250;
    const amountInPaisa = amountInRupees * 100;

    // Create a PENDING PaymentOrder first
    console.log(`Creating PaymentOrder with OrderID: ${mockOrderId}`);
    const paymentOrder = await prisma.paymentOrder.create({
        data: {
            orderId: mockOrderId,
            amount: 0, // usually generated by Razorpay logic, but here we manually set
            collectedAmount: amountInRupees,
            status: Status.PENDING,
            type: PaymentType.FEST_REGISTRATION,
            userId: user.id,
            paymentDataJson: {}
        }
    });

    const mockPaymentEntity = {
        id: mockPaymentId,
        entity: 'payment',
        amount: amountInPaisa,
        currency: 'INR',
        status: 'captured',
        order_id: mockOrderId,
        invoice_id: null,
        international: false,
        method: 'upi',
        amount_refunded: 0,
        refund_status: null,
        captured: true,
        description: 'Fest Registration',
        card_id: null,
        bank: null,
        wallet: null,
        vpa: 'test@upi',
        email: user.email,
        contact: user.phoneNumber,
        notes: {
            type: 'FEST_REGISTRATION',
            userId: String(user.id),
            registrationId: 'test-reg'
        },
        fee: 500,
        tax: 0,
        error_code: null,
        error_description: null,
        error_source: null,
        error_step: null,
        error_reason: null,
        acquirer_data: {
            bank_transaction_id: '123456789'
        },
        created_at: Math.floor(Date.now() / 1000)
    };

    console.log("Mock Payment Entity prepared.");

    // 3. Execute Logic
    const paymentData = createPaymentDataFromEntity(mockPaymentEntity, paymentOrder);
    
    console.log("---------------------------------------------------");
    console.log("Invoking processSuccessfulPayment...");
    console.log("---------------------------------------------------");

    const pid = await processSuccessfulPayment(paymentOrder, mockPaymentEntity, paymentData);

    console.log("---------------------------------------------------");
    console.log("Final Result:");
    if (pid) {
        console.log(`SUCCESS! PID: ${pid}`);
    } else {
        console.log("FAILED or NO PID generated.");
    }
    
    // Check if receipt updated
    const updatedOrder = await prisma.paymentOrder.findUnique({ where: { orderId: mockOrderId } });
    console.log(`Verification: ID=${updatedOrder?.id}, Status=${updatedOrder?.status}, Receipt=${updatedOrder?.receipt}`);

}

main()
  .catch((e) => {
    console.error("Script Execution Error:", e);
  })
  .finally(async () => {
    console.timeEnd('Total Execution Time');
    await prisma.$disconnect();
  });
