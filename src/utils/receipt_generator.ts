import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';
import bwipjs from 'bwip-js';
import dotenv from 'dotenv';

// Load environment variables
const envPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4000';

// Paths
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');
const TEMPLATE_PATH = path.join(ASSETS_DIR, 'Receipt-Template.png');
const LOG_FILE = path.resolve(__dirname, '..', '..', 'logs', 'receipt_generation_ts.log');
const GENERATED_DIR = path.join(ASSETS_DIR, 'generated_receipts');

async function log(message: string) {
  const timestamp = new Date().toISOString();
  const msg = `[${timestamp}] ${message}`;
  console.error(msg); // Log to stderr to keep stdout clean
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, msg + '\n');
  } catch (e) {
    console.error(`Failed to log to file: ${e}`);
  }
}

function numberToWords(amount: number): string {
  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  if (amount === 0) return 'Zero';

  if (amount < 20) return a[amount];

  if (amount < 100)
    return (
      b[Math.floor(amount / 10)] +
      (amount % 10 !== 0 ? ' ' + a[amount % 10] : '')
    );

  if (amount < 1000)
    return (
      a[Math.floor(amount / 100)] +
      'Hundred ' +
      (amount % 100 !== 0 ? 'and ' + numberToWords(amount % 100) : '')
    );

  if (amount < 100000)
    return (
      numberToWords(Math.floor(amount / 1000)) +
      'Thousand ' +
      (amount % 1000 !== 0 ? ' ' + numberToWords(amount % 1000) : '')
    );

  if (amount < 10000000)
    return (
      numberToWords(Math.floor(amount / 100000)) +
      'Lakh ' +
      (amount % 100000 !== 0 ? ' ' + numberToWords(amount % 100000) : '')
    );

  return amount.toString();
}

async function generateQrCode(data: string): Promise<Buffer> {
  return await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: data,
    scale: 3,
    includetext: false,
    textxalign: 'center',
  });
}

// NOTE: pdf-lib coordinate system starts from bottom-left.
// The python script used reportlab which also starts from bottom-left (mostly), but images were processed top-left in some contexts.
// However, the python script clearly uses `c.drawString(x, y)` where y seems to be inverted or relative to bottom.
// In python: user_details_top_start = template_height - 821.
// This confirms bottom-left origin. We can reuse the coordinates directly.

export async function generateReceiptPdf(orderData: any, userData: any): Promise<Buffer> {
  if (
    !(await fs
      .stat(TEMPLATE_PATH)
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error(`Template not found at ${TEMPLATE_PATH}`);
  }

  // Load template
  const templateBytes = await fs.readFile(TEMPLATE_PATH);
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed the template image
  const templateImage = await pdfDoc.embedPng(templateBytes);
  
  const width = 2480;
  const height = 3100;

  const page = pdfDoc.addPage([width, height]);
  page.drawImage(templateImage, {
    x: 0,
    y: 0,
    width: width,
    height: height,
  });

  const fontSize = 36;
  const helvetica = await pdfDoc.embedFont('Helvetica');

  const drawText = (text: string, x: number, y: number) => {
    page.drawText(text || '-', {
      x,
      y,
      size: fontSize,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
  };

  // Section 1: User Details
  const userDetailsLeftMargin = 620;
  const userDetailsTopStart = height - 821;
  const userDetailsLineSpacing = 89;

  drawText(userData.name, userDetailsLeftMargin, userDetailsTopStart);
  drawText(
    userData.email,
    userDetailsLeftMargin,
    userDetailsTopStart - userDetailsLineSpacing
  );
  drawText(
    userData.phoneNumber,
    userDetailsLeftMargin,
    userDetailsTopStart - userDetailsLineSpacing * 2
  );

  const college = userData.college || '-';
  drawText(
    college.toString(),
    userDetailsLeftMargin,
    userDetailsTopStart - userDetailsLineSpacing * 3
  );

  // Add PID
  const pidTopStart = height - 2966;
  const pidLeftMargin = 300;
  const pid = userData.pid || '-';
  drawText(`${pid}`, pidLeftMargin, pidTopStart);

  // Section 2: Payment Details
  const paymentDetailsLeftMargin = 620;
  const paymentDetailsTopStart = height - 1323;
  const paymentDetailsLineSpacing = 88;

  let paymentTypeStr = 'Fest Registration';
  if (orderData.type === 'ACC_REGISTRATION') {
    paymentTypeStr = 'Accomodation Fee Payment';
  }
  drawText(paymentTypeStr, paymentDetailsLeftMargin, paymentDetailsTopStart);

  // Date of Payment
  let paymentDateStr = '-';
  const paymentDate = orderData.updatedAt;
  if (paymentDate) {
    try {
      const dateObj = new Date(paymentDate);
      // Format dd/mm/yyyy
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      paymentDateStr = `${day}/${month}/${year}`;
    } catch (e) {
      paymentDateStr = String(paymentDate);
    }
  }
  drawText(
    paymentDateStr,
    paymentDetailsLeftMargin,
    paymentDetailsTopStart - paymentDetailsLineSpacing
  );

  // Order ID
  drawText(
    orderData.orderId,
    paymentDetailsLeftMargin,
    paymentDetailsTopStart - paymentDetailsLineSpacing * 2
  );

  // Payment Data parsing
  let paymentData = orderData.paymentData || {};
  if (typeof paymentData === 'string') {
    try {
      paymentData = JSON.parse(paymentData);
    } catch (e) {
      paymentData = {};
    }
  }

  const paymentId =
    paymentData.id || paymentData.gatewayPaymentId || '-';
  drawText(
    String(paymentId),
    paymentDetailsLeftMargin,
    paymentDetailsTopStart - paymentDetailsLineSpacing * 3
  );

  const method = paymentData.method || '-';
  drawText(
    String(method).toUpperCase(),
    paymentDetailsLeftMargin,
    paymentDetailsTopStart - paymentDetailsLineSpacing * 4
  );

  // Receipt Generation Date
  const genDateLeftMargin = 1650;
  const genDateTopStart = height - 535;
  const now = new Date();
  const receiptDate = `${now.getDate().toString().padStart(2, '0')}/${(
    now.getMonth() + 1
  )
    .toString()
    .padStart(2, '0')}/${now.getFullYear()}`;
  drawText(receiptDate, genDateLeftMargin, genDateTopStart);

  // Amount
  const amount = parseInt(orderData.collectedAmount);
  const amountDetailsLeftMargin = 620;
  const amountDetailsTopStart = height - 1900;
  const amountDetailsLineSpacing = 169;

  drawText(
    `Rs. ${amount}/-`,
    amountDetailsLeftMargin,
    amountDetailsTopStart
  );
  
  const words = numberToWords(amount) + ' Only';
  drawText(
    words,
    amountDetailsLeftMargin,
    amountDetailsTopStart - amountDetailsLineSpacing - 10
  );

  // QR Code
  const qrContent = `${SERVER_URL}/api/payment/receipt/${orderData.orderId}/verify?paymentId=${paymentId}`;
  await log(`Generated QR Link: ${qrContent}`);

  const qrBuffer = await generateQrCode(qrContent);
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  
  const qrCodeX = 1896;
  const qrCodeY = 1750;
  const qrCodeSize = 350;
  
  page.drawImage(qrImage, {
    x: qrCodeX,
    y: qrCodeY,
    width: qrCodeSize,
    height: qrCodeSize,
  });

  // Barcode for PID
  const barcodeX = 1850;
  const barcodeY = 98;

  if (pid && pid !== '-') {
    await log(`Drawing Barcode for PID: ${pid}`);
    const barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: pid,
        scale: 3, 
        height: 10,
        includetext: false, 
        textxalign: 'center',
    });
    
    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer);
    const barcodeDims = barcodeImage.scale(2.5); // Arbitrary scaling to match legacy look roughly
    
    page.drawImage(barcodeImage, {
        x: barcodeX,
        y: barcodeY,
        width: barcodeDims.width,
        height: 80, // matched to barHeight
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}


export async function generateReceipt(orderData: any, userData: any): Promise<string> {
    await log(`Starting receipt generation for ${orderData.orderId}`);

    const pdfBuffer = await generateReceiptPdf(orderData, userData);

    await fs.mkdir(GENERATED_DIR, { recursive: true });
    const filename = `receipt_${orderData.orderId}.pdf`;
    const filePath = path.join(GENERATED_DIR, filename);

    await fs.writeFile(filePath, pdfBuffer);
    await log(`Receipt generated at: ${filePath}`);
    
    return filePath;
}

// Only run main if this file is the entry point
if (require.main === module) {
    (async () => {
        const inputFile = process.argv[2];
        if (!inputFile) {
            console.error('Usage: ts-node receipt_generator.ts <json_file_or_string>');
            process.exit(1);
        }

        try {
            let data;
            if (
            await fs
                .stat(inputFile)
                .then(() => true)
                .catch(() => false)
            ) {
            const fileContent = await fs.readFile(inputFile, 'utf-8');
            data = JSON.parse(fileContent);
            } else {
            data = JSON.parse(inputFile);
            }

            const orderData = data.order_data;
            const userData = data.user_data;

            if (!orderData || !userData) {
            await log('Invalid JSON data: Missing order_data or user_data');
            process.exit(1);
            }

            const filePath = await generateReceipt(orderData, userData);
            console.log(filePath); // Output logic for script usage matches original
            
        } catch (error) {
            await log(`Error: ${error}`);
            console.error(error);
            process.exit(1);
        }
    })();
}

