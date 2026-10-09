import nodemailer from 'nodemailer';
import { config } from '../config.js';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!config.SMTP_HOST) return null;
  _transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined,
  });
  return _transporter;
}

export async function sendOtpEmail(params: {
  to: string;
  companyName: string;
  otp: string;
}): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback: log OTP when SMTP is not configured.
    console.log(`[DEV] OTP for ${params.companyName} → ${params.to}: ${params.otp}`);
    return;
  }

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #fff; border-radius: 16px; border: 1px solid #e5e7eb;">
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Welcome to CafePOS</h2>
      <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">Your company <strong>${params.companyName}</strong> is almost ready. Use the code below to verify your registration.</p>
      <div style="text-align: center; background: #fef3c7; border-radius: 12px; padding: 24px 32px; margin: 0 0 24px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #92400e; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Your OTP</p>
        <p style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #b45309;">${params.otp}</p>
      </div>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>`;

  await transporter.sendMail({
    from: config.SMTP_FROM || `"CafePOS" <noreply@cafepos.app>`,
    to: params.to,
    subject: `${params.otp} — Your CafePOS verification code`,
    html,
    text: `Your CafePOS OTP for ${params.companyName}: ${params.otp}\n\nThis code expires in 10 minutes.`,
  });
}
