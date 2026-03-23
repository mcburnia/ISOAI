import { Resend } from 'resend';
import { env } from '../config/env';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!resend) resend = new Resend(env.resendApiKey);
  return resend;
}

export async function sendInvitationEmail(
  to: string,
  name: string,
  temporaryPassword: string
): Promise<{ sent: boolean; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn('Resend not configured - skipping invitation email for', to);
    return { sent: false, error: 'Email not configured' };
  }

  const loginUrl = `${env.appUrl}/login`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0A5C26;">Welcome to Keep Me ISO</h2>
      <p>Hello ${name},</p>
      <p>An account has been created for you on the Keep Me ISO compliance platform.</p>
      <p>Here are your login credentials:</p>
      <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Temporary password:</strong> ${temporaryPassword}</p>
      </div>
      <p>You will be required to change your password when you first sign in.</p>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #0A5C26; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
          Sign in to Keep Me ISO
        </a>
      </p>
      <p style="color: #71717a; font-size: 12px; margin-top: 24px;">
        If you did not expect this email, please contact your administrator.
      </p>
    </div>
  `;

  const text = [
    'Welcome to Keep Me ISO',
    '',
    `Hello ${name},`,
    '',
    'An account has been created for you on the Keep Me ISO compliance platform.',
    '',
    `Email: ${to}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    `Sign in at: ${loginUrl}`,
    '',
    'You will be required to change your password on first sign-in.',
  ].join('\n');

  try {
    await client.emails.send({
      from: env.emailFrom,
      to,
      subject: 'Welcome to Keep Me ISO – Your Account Details',
      html,
      text,
    });
    return { sent: true };
  } catch (err: any) {
    console.error('Failed to send invitation email:', err.message);
    return { sent: false, error: err.message };
  }
}
