
import { generateReceiptPdf } from './utils/receipt_generator';
import { uploadReceipt } from './utils/upload_receipt';
import fs from 'fs';
import path from 'path';

async function main() {
    console.log("Starting debug...");
    const currentDate = new Date();
    
    // Mock Order Data for ACC
    const orderData = {
        orderId: 'order_acc_debug_123',
        type: 'ACC_REGISTRATION',
        updatedAt: currentDate,
        collectedAmount: 200, // Number
        paymentData: {
            id: 'pay_123',
            method: 'upi',
        }
    };

    // Mock User Data
    const userData = {
        name: 'Debug User',
        email: 'debug@example.com',
        phoneNumber: '9876543210',
        college: 'Debug Internal College',
        pid: 'NMAMIT-123'
    };

    try {
        console.log("Generating PDF...");
        const buffer = await generateReceiptPdf(orderData, userData);
        console.log(`PDF Generated. Size: ${buffer.length} bytes`);

        const dumpPath = path.resolve(__dirname, '../debug_receipt.pdf');
        fs.writeFileSync(dumpPath, buffer);
        console.log(`Saved locally to ${dumpPath}`);

        console.log("Uploading to UploadThing...");
        // Comment out real upload to save bandwidth/tokens if only debugging generation first
        // But the error might be in upload, so let's try.
        const url = await uploadReceipt({ buffer, name: `debug_receipt_${orderData.orderId}.pdf` });
        console.log(`Upload Result: ${url}`);
        
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
