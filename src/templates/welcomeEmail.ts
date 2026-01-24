import { getUtilityEmailHtml } from './utilityEmail';

export const getWelcomeEmailHtml = (name: string, pid?: string): string => {
  const pidSection = pid
    ? `
      <div style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Your PID Number</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">${pid}</p>
      </div>
      <p style="margin: 0 0 16px;">
        You can use this PID to register for events and experience the pronites!
      </p>
    `
    : '';

  const content = `
    <h2 style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 0 0 24px; text-align: center;">Welcome to Incridea!</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>
      You have successfully registered to <strong>Incridea '26</strong> and you are ready to experience the fest!
    </p>
    ${pidSection}
    <p>
      We are happy to have you and hope you have a wonderful experience at Incridea.
    </p>
    <div style="margin-top: 32px; text-align: center;">
      <a href="https://incridea.in" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 50px; font-weight: 600; display: inline-block;">Explore Incridea</a>
    </div>
  `;

  return getUtilityEmailHtml(content);
};
