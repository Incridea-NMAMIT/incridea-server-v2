
// Simple in-memory store for payment processing steps
// Key: Order ID, Value: Current Processing Step
const paymentStatusMap = new Map<string, string>();

export const setPaymentStep = (orderId: string, step: string) => {
  paymentStatusMap.set(orderId, step);
};

export const getPaymentStep = (orderId: string): string | undefined => {
  return paymentStatusMap.get(orderId);
};

export const clearPaymentStep = (orderId: string) => {
  paymentStatusMap.delete(orderId);
};
