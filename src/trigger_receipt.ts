
import { addReceiptJob } from './utils/queue';

async function main() {
    console.log("Triggering receipt job...");
    
    const currentDate = new Date(); 
    
    const orderData = {
        orderId: 'order_trigger_test_' + Date.now(),
        type: 'ACC_REGISTRATION', 
        updatedAt: currentDate,
        collectedAmount: 200, 
        paymentData: { 
            id: 'pay_trigger_123',
            method: 'upi',
        }
    };

    const userData = {
        name: 'Trigger User No PID',
        email: 'trigger_nopid@example.com',
        phoneNumber: '9876543210',
        college: undefined,
        pid: undefined
    };

    try {
        await addReceiptJob({
            orderData,
            userData,
            userId: 9999
        });
        console.log("Job added to queue.");
    } catch (e) {
        console.error("Error adding job:", e);
    }
    
    setTimeout(() => {
        console.log("Exiting...");
        process.exit(0);
    }, 2000);
}

main();
