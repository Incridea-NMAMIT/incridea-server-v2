import { getUtilityEmailHtml } from './utilityEmail';
import { env } from '../utils/env';

export const getPaymentReceiptEmailHtml = (name: string, paymentType: string): string => {
  const contactUrl = `${env.frontendUrl}/contact`; // Assuming env.frontendUrl exists, otherwise user provided 'VITE_MAIN_URL' which implies frontend

  const content = `
    <h2 style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 24px; text-align: center;">Payment Receipt</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>
      Please find attached the payment receipt for your <strong>${paymentType}</strong> payment.
    </p>
    <p>
      This receipt is automatically generated and serves as proof of your payment.
    </p>
    <p>
        If you have any queries, please <a href="${contactUrl}" style="color: #60a5fa; text-decoration: underline;">contact us</a>.
    </p>
  `;

  return getUtilityEmailHtml(content);
};
