import { Category, Status } from '@prisma/client';
import prisma from '../prisma/client';

/**
 * Generate a PID for a user if they don't already have one.
 * Format: INC-{X}{Y}NNNN
 * X: U (Internal), X (External), A (Alumni)
 * Y: N (New), R (Returning/Prior User)
 * NNNN: Auto-incrementing number padded to 4 digits
 */
export async function generatePID(userId: number, paymentOrderId: string) {
  return await prisma.$transaction(async (tx) => {
    // 0. Verify Payment Order Status
    const paymentOrder = await tx.paymentOrder.findUnique({
      where: { orderId: paymentOrderId },
    });

    if (!paymentOrder) {
      throw new Error('Payment Order not found');
    }

    if (paymentOrder.status !== Status.SUCCESS) {
      throw new Error('Cannot generate PID: Payment is not successful');
    }

    // 1. Check if user already has a PID
    const existingPID = await tx.pID.findUnique({
      where: { userId },
    });
    if (existingPID) {
      return existingPID;
    }

    // 2. Fetch User to determine Category (X)
    const user = await tx.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    let xCode = 'X'; // Default External
    if (user.category === Category.INTERNAL) xCode = 'U';
    else if (user.category === Category.EXTERNAL) xCode = 'X';
    else if (user.category === Category.ALUMNI) xCode = 'A';

    // 3. Check PriorUser to determine (Y)
    const priorUser = await tx.priorUser.findUnique({
      where: { email: user.email },
    });
    const yCode = priorUser ? 'R' : 'N';

    // 4. Generate Auto-increment Number (NNNN) based on X type
    const variableKey = `PID_${xCode}`; // PID_U, PID_X, PID_A
    
    // Upsert ServerVariable to get next value
    // Note: upsert returns the object. We want to increment it.
    // However, standardized way to increment is to fetch and update or use raw query for concurrency safety.
    // In Prisma, we can use update with increment.
    
    // Ensure it exists first? Or just upsert.
    // If we use upsert with create: { value: 1 }, update: { value: { increment: 1 } }, it works.
    const serverVar = await tx.serverVariable.upsert({
      where: { key: variableKey },
      update: { value: { increment: 1 } },
      create: { key: variableKey, value: 1 },
    });
    
    const sequenceNumber = serverVar.value;
    const paddedNumber = sequenceNumber.toString().padStart(4, '0');

    const pidCode = `INC-${xCode}${yCode}${paddedNumber}`;

    // 5. Create PID
    const newPID = await tx.pID.create({
      data: {
        pidCode,
        userId,
        paymentOrderId,
      },
    });

    return newPID;
  });
}
