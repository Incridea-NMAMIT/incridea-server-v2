import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { UTApi } from 'uploadthing/server';
import prisma from '../prisma/client';


const utapi = new UTApi();

// Simple file logger
const logFile = path.resolve(__dirname, '../../logs/receipt_service.log');

function logToFile(msg: string) {
    try {
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
}

export async function generateAndUploadReceipt(userId: number, orderId: string) {
    try {
        logToFile(`Starting receipt generation for User ID: ${userId}, Order ID: ${orderId}`);
        console.log(`Starting receipt generation for User ID: ${userId}, Order ID: ${orderId}`);

        // 1. Fetch Data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                College: true,
                PID: true,
            },
        });

        if (!user) {
            const msg = `User not found: ${userId}`;
            console.error(msg);
            logToFile(msg);
            return;
        }

        // Fetch the specific payment order
        const paymentOrder = await prisma.paymentOrder.findUnique({
            where: { orderId: orderId },
            include: {
                paymentData: true 
            }
        });

        if (!paymentOrder) {
            const msg = `Payment Order not found: ${orderId}`;
            console.error(msg);
            logToFile(msg);
            return;
        }

        if (paymentOrder.status !== 'SUCCESS') {
             const msg = `Payment Order ${orderId} is not in SUCCESS state. Current: ${paymentOrder.status}`;
             console.error(msg);
             logToFile(msg);
             return;
        }

        if (paymentOrder.receipt) {
            const msg = `Receipt already exists for Order: ${paymentOrder.orderId}`;
            console.log(msg);
            logToFile(msg);
             // Proceed to regenerate? Or return?
             // For now, let's allow overwrite as per previous logic, but maybe we should check if file exists.
        }

        // 2. Prepare JSON Data for Python Script
        const inputData = {
            order_data: {
                orderId: paymentOrder.orderId,
                amount: paymentOrder.amount,
                collectedAmount: paymentOrder.collectedAmount,
                currency: 'INR',
                receipt: paymentOrder.orderId,
                status: 'paid',
                type: paymentOrder.type,
                updatedAt: paymentOrder.updatedAt.toISOString(),
                paymentData: paymentOrder.paymentDataJson || paymentOrder.paymentData,
            },
            user_data: {
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                college: user.College?.name || 'Other',
                pid: user.PID?.pidCode || '-',
            },
        };

        const inputJson = JSON.stringify(inputData);

        // 3. Call Python Script
        // Script is in scripts/receipt_generator.py relative to root
        // This file is in src/services/
        const pythonScriptPath = path.resolve(__dirname, '../../scripts/receipt_generator.py');
        
        const command = process.platform === 'win32' ? 'python' : 'python3';
        
        console.log(`Spawning ${command} with script: ${pythonScriptPath}`);
        logToFile(`Spawning ${command} with script: ${pythonScriptPath}`);

        const pythonProcess = spawn(command, [pythonScriptPath, inputJson]); 

        let scriptOutput = '';
        let scriptError = '';

        pythonProcess.stdout.on('data', (data) => {
            scriptOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            scriptError += data.toString();
        });

        pythonProcess.on('close', async (code) => {
            if (code !== 0) {
                const msg = `Receipt generation script failed with code ${code}\nStderr: ${scriptError}`;
                console.error(msg);
                logToFile(msg);
                return;
            }

            const receivedPath = scriptOutput.trim();
            console.log(`Python script output path: ${receivedPath}`);
            logToFile(`Python script output path: ${receivedPath}`);

            if (!receivedPath || !fs.existsSync(receivedPath)) {
                const msg = `Generated file not found at: ${receivedPath}\nScript Output: ${scriptOutput}`;
                console.error(msg);
                logToFile(msg);
                return;
            }

            // 4. Upload to UploadThing
            try {
                console.log('Uploading receipt to UploadThing...');
                logToFile('Uploading receipt to UploadThing...');
                
                const fileBuffer = fs.readFileSync(receivedPath);
                const file = new File([fileBuffer], `receipt_${paymentOrder.orderId}.pdf`, { type: 'application/pdf' });
                
                const response = await utapi.uploadFiles([file]);
                
                if (response[0]?.data?.url) {
                    const receiptUrl = response[0].data.url;
                    console.log(`Receipt uploaded successfully: ${receiptUrl}`);
                    logToFile(`Receipt uploaded successfully: ${receiptUrl}`);

                    // 5. Update Database
                    await prisma.paymentOrder.update({
                        where: { id: paymentOrder.id },
                        data: { receipt: receiptUrl }
                    });
                    console.log('Database updated with receipt URL.');
                    logToFile('Database updated with receipt URL.');

                    // Local file cleanup is handled by us or script? Script writes it. 
                    // We can delete it now if we want to save space.
                    // fs.unlinkSync(receivedPath); 

                } else {
                     const msg = `UploadThing upload failed: ${JSON.stringify(response[0].error)}`;
                     console.error(msg);
                     logToFile(msg);
                }

            } catch (uploadError) {
                console.error('Error during upload/update:', uploadError);
                logToFile(`Error during upload/update: ${uploadError}`);
            }
        });

        pythonProcess.on('error', (err) => {
             console.error(`Failed to spawn ${command} process:`, err);
             logToFile(`Failed to spawn ${command} process: ${err}`);
        });

    } catch (error) {
        console.error('Error in generateAndUploadReceipt:', error);
        logToFile(`Error in generateAndUploadReceipt: ${error}`);
    }
}
