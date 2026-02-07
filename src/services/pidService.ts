import { Category, Status } from '@prisma/client';
import prisma from '../prisma/client';

export async function generatePID(userId: number, paymentOrderId: string) {
  return await prisma.$transaction(async (tx) => {
    const paymentOrder = await tx.paymentOrder.findUnique({
      where: { orderId: paymentOrderId },
    });

    if (!paymentOrder) {
      throw new Error('Payment Order not found');
    }

    if (paymentOrder.status !== Status.SUCCESS) {
      throw new Error('Cannot generate PID: Payment is not successful');
    }

    const existingPID = await tx.pID.findUnique({
      where: { userId },
    });
    if (existingPID) {
      return existingPID;
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    let xCode = 'X'; 
    if (user.category === Category.INTERNAL) xCode = 'U';
    else if (user.category === Category.EXTERNAL) xCode = 'X';
    else if (user.category === Category.ALUMNI) xCode = 'A';

    const priorUser = await tx.priorUser.findUnique({
      where: { email: user.email },
    });
    const yCode = priorUser ? 'R' : 'N';

    const variableKey = `PID_${xCode}`; 
    
    
    const serverVar = await tx.serverVariable.upsert({
      where: { key: variableKey },
      update: { value: { increment: 1 } },
      create: { key: variableKey, value: 1 },
    });
    
    const sequenceNumber = serverVar.value;
    const paddedNumber = sequenceNumber.toString().padStart(4, '0');

    const pidCode = `INC-${xCode}${yCode}${paddedNumber}`;

    const newPID = await tx.pID.create({
      data: {
        pidCode,
        userId,
      },
    });

    return newPID;
  });
}
