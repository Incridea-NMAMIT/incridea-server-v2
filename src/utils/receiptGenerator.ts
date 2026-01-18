
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import bwipjs from 'bwip-js'
import { UTApi } from 'uploadthing/server'
import fs from 'fs'
import path from 'path'
import { PaymentOrder, User, PaymentType } from '@prisma/client'
import { env } from './env'

const utapi = new UTApi({
  token: env.uploadthing.token,
})

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
  console.log('Starting receipt generation for Order ID:', paymentOrder.orderId);
  try {
    const templatePath = path.join(__dirname, '../assets/receipt_template.png')
    const templateBytes = fs.readFileSync(templatePath)

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

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const fontSize = 56
    const textColor = rgb(0, 0, 0)

    // Section 1: User Details (Name, Email, Phone)
    const userDetailsLeftMargin = 880
    const userDetailsTopStart = height - 635
    const userDetailsLineSpacing = 128

    // Section 2: Payment Details (Type, Order ID, Payment ID, Method)
    const paymentDetailsLeftMargin = 880
    const paymentDetailsTopStart = height - 1125
    const paymentDetailsLineSpacing = 132

    // Section 3: Amount Details (Amount, Amount in Words)
    const amountDetailsLeftMargin = 880
    const amountDetailsTopStart = height - 1770
    const amountDetailsLineSpacing = 180
    const qrCodeX = 2855
    const qrCodeY = 1315
    const qrCodeSize = 500

    // Helper to draw text
    const drawDetails = (text: string, x: number, y: number) => {
        page.drawText(text, {
            x,
            y,
            size: fontSize,
            font: fontRegular,
            color: textColor,
        })
    }

    // 1. Name
    drawDetails(user.name, userDetailsLeftMargin, userDetailsTopStart)

    // 2. Email
    drawDetails(user.email, userDetailsLeftMargin, userDetailsTopStart - userDetailsLineSpacing)

    // 3. Phone Number
    drawDetails(user.phoneNumber, userDetailsLeftMargin, userDetailsTopStart - (userDetailsLineSpacing * 2))

    // --- Payment Details Section ---
    
    // 4. Payment Type
    let paymentTypeStr = 'Fest Registration'
    if (paymentOrder.type === PaymentType.ACC_REGISTRATION) paymentTypeStr = 'Accommodation Registration'
    else if (paymentOrder.type === PaymentType.EVENT_REGISTRATION) paymentTypeStr = 'Event Registration'
    
    drawDetails(paymentTypeStr, paymentDetailsLeftMargin, paymentDetailsTopStart)

    // 5. Order ID
    drawDetails(paymentOrder.orderId, paymentDetailsLeftMargin, paymentDetailsTopStart - paymentDetailsLineSpacing)

    // 6. Payment ID
    const paymentId = paymentData.id || paymentData.gatewayPaymentId || '-'
    drawDetails(paymentId, paymentDetailsLeftMargin, paymentDetailsTopStart - (paymentDetailsLineSpacing * 2))

    // 7. Payment Method
    const method = paymentData.method || '-'
    drawDetails(String(method).toUpperCase(), paymentDetailsLeftMargin, paymentDetailsTopStart - (paymentDetailsLineSpacing * 3))

    // --- Amount Details Section ---
    
    // 8. Amount
    drawDetails(`Rs. ${paymentOrder.collectedAmount}/-`, amountDetailsLeftMargin, amountDetailsTopStart)

    // 9. Amount in Words
    const words = numberToWords(paymentOrder.collectedAmount) + ' Only'
    drawDetails(words, amountDetailsLeftMargin, amountDetailsTopStart - amountDetailsLineSpacing - 10) 

    // 10. QR Code
    const qrContent = `${env.serverUrl}/payment/receipt/${paymentOrder.orderId}/verify?paymentId=${paymentId}` 
    
    const qrPng = await bwipjs.toBuffer({
        bcid: 'qrcode', 
        text: qrContent,
        scale: 4, 
        includetext: false,  
    })

    const qrImage = await pdfDoc.embedPng(qrPng)
    page.drawImage(qrImage, {
        x: qrCodeX, 
        y: qrCodeY, 
        width: qrCodeSize,
        height: qrCodeSize,
    })

    const pdfBytes = await pdfDoc.save()
    console.log('PDF Generated successfully. Size:', pdfBytes.length);
    
    const fileName = `receipt_${paymentOrder.orderId}.pdf`
    
    const file = new File([pdfBytes as any], fileName, { type: 'application/pdf' })
    console.log('File object created. Name:', fileName, 'Size:', file.size, 'Type:', file.type);
    
    console.log('Initiating upload to UploadThing...');
    const response = await utapi.uploadFiles([file])
    console.log('UploadThing Response:', JSON.stringify(response, null, 2));
    
    if ((response[0]?.data as any)?.ufsUrl) {
        return (response[0]?.data as any)?.ufsUrl
    }
    
    return null

  } catch (error) {
    console.error('Error generating receipt details:', error)
    return null
  }
}
