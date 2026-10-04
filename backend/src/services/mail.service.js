import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;
if (env.smtp.host && env.smtp.user && env.smtp.pass) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!transporter) return false;
  await transporter.sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject: 'PCA Pvt. Ltd password reset',
    text: `Hello ${name},\n\nUse this link to reset your PCA Pvt. Ltd password:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>PCA Pvt. Ltd password reset</h2><p>Hello ${name},</p><p>Click the button below to create a new password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#4f6ef7;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
  return true;
}

export async function sendPasswordResetOtp({ to, name, otp }) {
  if (!transporter) return false;
  await transporter.sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject: 'Your PCA Pvt. Ltd password reset code',
    text: `Hello ${name},\n\nYour password reset code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>PCA Pvt. Ltd password reset</h2><p>Hello ${name},</p><p>Your password reset code is:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#4f6ef7">${otp}</p><p>This code expires in 10 minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`,
  });
  return true;
}