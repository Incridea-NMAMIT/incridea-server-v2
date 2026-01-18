
import { generateReceipt } from '../src/utils/receiptGenerator';
import { PaymentType, Status, PaymentMethod, PaymentStatus } from '@prisma/client';

// Mock Data matching the types expected by generateReceipt
// paymentOrder: PaymentOrder
// user: User
// paymentData: any

const mockUser = {
    id: 999,
    name: "Test User",
    email: "test@example.com",
    phoneNumber: "1234567890",
    clerkId: "clerk_123",
    role: "USER",
    createdAt: new Date(),
    updatedAt: new Date(),
    profileImage: null,
    gender: "MALE",
    isVerified: true,
    password: "hashed_password",
    category: "INTERNAL",
    collegeId: 1,
    otpHash: null,
    otpExpiresAt: null,
} as any;

const mockPaymentOrder = {
    id: "order_123",
    orderId: "order_rcptid_11", // Short ID for file name
    amount: 25000, // paisa
    collectedAmount: 250, // rupees
    status: Status.SUCCESS,
    type: PaymentType.FEST_REGISTRATION,
    userId: 999,
    paymentDataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    receipt: null
} as any;

const mockPaymentData = {
    id: "pay_1234567890",
    method: PaymentMethod.UPI,
    amount: 25000,
    status: PaymentStatus.CAPTURED,
    email: "test@example.com",
    contact: "1234567890"
};

async function runTest() {
    console.log("Starting Receipt Generation Test...");
    try {
        const url = await generateReceipt(mockPaymentOrder, mockUser, mockPaymentData);
        if (url) {
            console.log("✅ Success! Receipt URL:", url);
        } else {
            console.error("❌ Failed: URL is null");
        }
    } catch (error) {
        console.error("❌ Exception during test:", error);
    }
}

runTest();
