import nodemailer from 'nodemailer'
import { env } from './env'

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
})

export async function sendEmail(to: string, subject: string, text: string, html?: string, attachments?: any[]) {
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
    console.error('Failed to send email via SMTP. Logging content instead:', error)
    console.log(`--- EMAIL (${to}) ---\nSubject: ${subject}\n\n${text}\n\n[HTML Body included]\n-----------------------`)
  }
}
