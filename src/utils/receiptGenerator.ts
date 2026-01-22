
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import bwipjs from 'bwip-js'
import { UTApi } from 'uploadthing/server'
import fs from 'fs'
import path from 'path'
import { PaymentOrder, User, PaymentType } from '@prisma/client'
import { env } from './env'
import { File } from 'node:buffer'
import prisma from '../prisma/client'

const utapi = new UTApi({
  token: env.uploadthing.token,
})

const LOG_FILE = path.join(__dirname, '../../logs/receipt_generation.log')

function logToFile(message: string) {
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] ${message}\n`
    try {
        const logDir = path.dirname(LOG_FILE)
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true })
        }
        fs.appendFileSync(LOG_FILE, logLine)
        console.log(message) // Keep console log as well
    } catch (e) {
        console.error('Failed to write to log file:', e)
    }
}

logToFile(`[ReceiptGenerator] UTAPI initialized. Token present: ${!!env.uploadthing.token}`)

function numberToWords(amount: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']



  if (amount === 0) return 'Zero'
  
  if (amount < 20) return a[amount]
  
  if (amount < 100) {
      return b[Math.floor(amount / 10)] + ((amount % 10 !== 0) ? ' ' + a[amount % 10] : '')
  }
  
  if (amount < 1000) {
      return a[Math.floor(amount / 100)] + 'Hundred ' + (amount % 100 !== 0 ? 'and ' + numberToWords(amount % 100) : '')
  }
  
  if (amount < 100000) {
      return numberToWords(Math.floor(amount / 1000)) + 'Thousand ' + (amount % 1000 !== 0 ? ' ' + numberToWords(amount % 1000) : '')
  }

  if (amount < 10000000) {
       return numberToWords(Math.floor(amount / 100000)) + 'Lakh ' + (amount % 100000 !== 0 ? ' ' + numberToWords(amount % 100000) : '')
  }
  
  return amount.toString()
}

export async function generateReceipt(paymentOrder: PaymentOrder, user: User, paymentData: any): Promise<string | null> {
  logToFile(`Starting receipt generation for Order ID: ${paymentOrder.orderId}`);
  try {
    const templatePath = path.join(__dirname, '../assets/receipt_template.png')
    logToFile(`[ReceiptGenerator] Resolved Template Path: ${templatePath}`)
    
    if (!fs.existsSync(templatePath)) {
        logToFile(`[ReceiptGenerator] Template file NOT found at: ${templatePath}`)
        throw new Error('Receipt template missing')
    }
    logToFile('[ReceiptGenerator] Checkpoint 1: Reading template')
    const templateBytes = fs.readFileSync(templatePath)

    logToFile('[ReceiptGenerator] Checkpoint 2: Creating PDF Doc')
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([3720, 2631]) 
    
    const image = await pdfDoc.embedPng(templateBytes)
    const { width, height } = image.scale(1)
    
    page.setSize(width, height)
    page.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height,
    })

    logToFile('[ReceiptGenerator] Checkpoint 3: Drawing details')
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    // ... setup vars ...
    const fontSize = 56
    const textColor = rgb(0, 0, 0)

    // Section 1: User Details
    const userDetailsLeftMargin = 880
    const userDetailsTopStart = height - 635
    const userDetailsLineSpacing = 128
    const paymentDetailsLeftMargin = 880
    const paymentDetailsTopStart = height - 1125
    const paymentDetailsLineSpacing = 132
    const amountDetailsLeftMargin = 880
    const amountDetailsTopStart = height - 1770
    const amountDetailsLineSpacing = 180
    const qrCodeX = 2855
    const qrCodeY = 1315
    const qrCodeSize = 500

    const drawDetails = (text: string, x: number, y: number) => {
        page.drawText(text, {
            x,
            y,
            size: fontSize,
            font: fontRegular,
            color: textColor,
        })
    }

    drawDetails(user.name, userDetailsLeftMargin, userDetailsTopStart)
    drawDetails(user.email, userDetailsLeftMargin, userDetailsTopStart - userDetailsLineSpacing)
    drawDetails(user.phoneNumber, userDetailsLeftMargin, userDetailsTopStart - (userDetailsLineSpacing * 2))

    let paymentTypeStr = 'Fest Registration'
    if (paymentOrder.type === PaymentType.ACC_REGISTRATION) paymentTypeStr = 'Accommodation Registration'
    else if (paymentOrder.type === PaymentType.EVENT_REGISTRATION) paymentTypeStr = 'Event Registration'
    
    drawDetails(paymentTypeStr, paymentDetailsLeftMargin, paymentDetailsTopStart)
    drawDetails(paymentOrder.orderId, paymentDetailsLeftMargin, paymentDetailsTopStart - paymentDetailsLineSpacing)

    const paymentId = paymentData.id || paymentData.gatewayPaymentId || '-'
    drawDetails(paymentId, paymentDetailsLeftMargin, paymentDetailsTopStart - (paymentDetailsLineSpacing * 2))
    const method = paymentData.method || '-'
    drawDetails(String(method).toUpperCase(), paymentDetailsLeftMargin, paymentDetailsTopStart - (paymentDetailsLineSpacing * 3))

    drawDetails(`Rs. ${paymentOrder.collectedAmount}/-`, amountDetailsLeftMargin, amountDetailsTopStart)
    const words = numberToWords(paymentOrder.collectedAmount) + ' Only'
    drawDetails(words, amountDetailsLeftMargin, amountDetailsTopStart - amountDetailsLineSpacing - 10) 

    logToFile('[ReceiptGenerator] Checkpoint 4: Generating QR')
    // 10. QR Code
    const qrContent = `${env.serverUrl}/api/payment/receipt/${paymentOrder.orderId}/verify?paymentId=${paymentId}` 
    logToFile(`[ReceiptGenerator] Generated QR Link: ${qrContent}`)
    
    const qrPng = await bwipjs.toBuffer({
        bcid: 'qrcode', 
        text: qrContent,
        scale: 4, 
        includetext: false,  
    })

    logToFile('[ReceiptGenerator] Checkpoint 5: Embedding QR')
    const qrImage = await pdfDoc.embedPng(qrPng)
    page.drawImage(qrImage, {
        x: qrCodeX, 
        y: qrCodeY, 
        width: qrCodeSize,
        height: qrCodeSize,
    })

    logToFile('[ReceiptGenerator] Checkpoint 6: Saving PDF')
    const pdfBytes = await pdfDoc.save()
    logToFile(`PDF Generated successfully. Size: ${pdfBytes.length}`);
    
    const fileName = `receipt_${paymentOrder.orderId}.pdf`
    
    logToFile('[ReceiptGenerator] Checkpoint 7: Creating File Object')
    const file = new File([pdfBytes as any], fileName, { type: 'application/pdf' })
    logToFile(`File object created. Name: ${fileName}, Size: ${file.size}, Type: ${file.type}`);
    
    logToFile('[ReceiptGenerator] Checkpoint 8: Uploading to UploadThing')
    logToFile('Initiating upload to UploadThing...');
    const response = await utapi.uploadFiles([file])
    logToFile(`UploadThing Response: ${JSON.stringify(response, null, 2)}`);
    
    logToFile('[ReceiptGenerator] Checkpoint 9: Processing Response')
    if (response[0]?.error) {
        logToFile(`UploadThing Error: ${JSON.stringify(response[0].error)}`)
        return null
    }

    const startData = response[0]?.data
    logToFile(`UploadThing Response Data: ${JSON.stringify(startData, null, 2)}`);
    
    // Check for url or ufsUrl (v6 vs v7 differences sometimes)
    // @ts-ignore
    const url = startData?.url || startData?.ufsUrl || startData?.appUrl

    
    if (url) {
        logToFile(`Upload successful, URL: ${url}`)
        
        // Update DB
        try {
            logToFile(`[ReceiptGenerator] Attempting to update PaymentOrder: ${paymentOrder.orderId}`)
            
            // 1. Verify existence first
            const check = await prisma.paymentOrder.findUnique({ where: { orderId: paymentOrder.orderId }})
            logToFile(`[ReceiptGenerator] Pre-update check found: ${check ? `Yes (ID: ${check.id})` : 'NO'}`)

            // 2. Update
            const updated = await prisma.paymentOrder.update({
                where: { orderId: paymentOrder.orderId },
                data: { receipt: url }
            })
            logToFile(`[ReceiptGenerator] PaymentOrder updated. New Receipt: ${updated.receipt}`)
            
        } catch (dbError) {
             logToFile(`[ReceiptGenerator] Failed to update DB: ${dbError}`)
        }

        return url
    }
    
    logToFile('No URL found in UploadThing response')
    return null

  } catch (error) {
    logToFile(`Error generating receipt details: ${error}`)
    return null
  }
}
