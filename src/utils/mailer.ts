import nodemailer from 'nodemailer'
import { env } from './env'

// Create a pool of transporters or just create one on the fly.
// Since we want to rotate randomly per email, creating on the fly is safer/easier to ensure rotation 
// unless we want to keep 5 open connections (which might be overkill or timed out).

export async function sendEmail(to: string, subject: string, text: string, html?: string, attachments?: any[]) {
  // Select a random account
  const account = env.smtp.accounts[Math.floor(Math.random() * env.smtp.accounts.length)]
  
  const transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: account.user,
      pass: account.pass,
    },
  })

  // For debugging/verification
  console.log(`Sending email using SMTP account: ${account.user}`)

  try {
    await transporter.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text,
      html,
      attachments,
    })
  } catch (error) {
    console.error(`Failed to send email via SMTP (${account.user}). Logging content instead:`, error)
    console.log(`--- EMAIL (${to}) ---\nSubject: ${subject}\n\n${text}\n\n[HTML Body included]\n-----------------------`)
  }
}
