import "server-only";

import nodemailer from "nodemailer";

export interface SmtpSendInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

export interface SmtpSendResult {
  messageId: string;
}

/**
 * Best-effort Gmail SMTP fallback. Triggered only when Resend returns 429 or
 * 5xx (see dispatcher.ts). Requires a Google App Password — see .env.example.
 * Throws if not configured; caller should catch + surface as EMAIL_SEND_FAILED.
 */
export async function sendViaGmail(
  input: SmtpSendInput,
): Promise<SmtpSendResult> {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("gmail_smtp_not_configured");
  }
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const info = await transporter.sendMail({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return { messageId: info.messageId };
}
