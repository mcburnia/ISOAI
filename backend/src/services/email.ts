import nodemailer from 'nodemailer';
import { env } from '../config/env';

function isSmtpConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

export async function sendInvitationEmail(
  to: string,
  name: string,
  temporaryPassword: string
): Promise<{ sent: boolean; error?: string }> {
  if (!isSmtpConfigured()) {
    console.warn('SMTP not configured - skipping invitation email for', to);
    return { sent: false, error: 'SMTP not configured' };
  }

  const loginUrl = `${env.appUrl}/login`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0A5C26;">Welcome to ISOAI</h2>
      <p>Hello ${name},</p>
      <p>An account has been created for you on the ISO 42001 AIMS Compliance Platform.</p>
      <p>Here are your login credentials:</p>
      <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Temporary Password:</strong> ${temporaryPassword}</p>
      </div>
      <p>You will be required to change your password when you first log in.</p>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #0A5C26; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          Sign In to ISOAI
        </a>
      </p>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
        If you did not expect this email, please contact your administrator.
      </p>
    </div>
  `;

  const text = [
    'Welcome to ISOAI',
    '',
    `Hello ${name},`,
    '',
    'An account has been created for you on the ISO 42001 AIMS Compliance Platform.',
    '',
    `Email: ${to}`,
    `Temporary Password: ${temporaryPassword}`,
    '',
    `Sign in at: ${loginUrl}`,
    '',
    'You will be required to change your password on first login.',
  ].join('\n');

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: env.smtpFrom,
      to,
      subject: 'Welcome to ISOAI - Your Account Details',
      html,
      text,
    });
    return { sent: true };
  } catch (err: any) {
    console.error('Failed to send invitation email:', err.message);
    return { sent: false, error: err.message };
  }
}
