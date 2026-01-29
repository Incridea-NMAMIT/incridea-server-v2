import Razorpay from 'razorpay'


if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_SEC_KEY_ID || !process.env.RAZORPAY_SEC_KEY_SECRET || !process.env.RAZORPAY_WEBHOOK_SECRET || !process.env.RAZORPAY_SEC_WEBHOOK_SECRET) {
  console.warn('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set')
}

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})


export const razorpayAccommodation = new Razorpay({
  key_id: process.env.RAZORPAY_SEC_KEY_ID,
  key_secret: process.env.RAZORPAY_SEC_KEY_SECRET,
})

export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET
export const RAZORPAY_ACC_WEBHOOK_SECRET = process.env.RAZORPAY_SEC_WEBHOOK_SECRET
