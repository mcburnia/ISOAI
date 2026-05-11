import { Resend } from 'resend';
import { env } from '../config/env';

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.resendApiKey) return null;
  if (!resend) resend = new Resend(env.resendApiKey);
  return resend;
}

const TYPE_LABELS: Record<string, string> = {
  OBLIGATION_DUE: 'Due soon',
  OBLIGATION_OVERDUE: 'Overdue',
  COMPETENCE_DUE: 'Competence check',
  TRAINING_RENEWAL: 'Training renewal',
};

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

export async function sendNotificationDigestEmail(
  to: string,
  name: string,
  items: Array<{ title: string; message: string; type: string }>
): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn('Resend not configured - skipping notification digest for', to);
    return;
  }

  const loginUrl = `${env.appUrl}`;

  const itemsHtml = items
    .map((item) => {
      const label = TYPE_LABELS[item.type] ?? item.type;
      const badgeColour = item.type === 'OBLIGATION_OVERDUE' ? '#dc2626' : '#F97316';
      return `
        <div style="border-left: 3px solid ${badgeColour}; padding: 10px 14px; margin: 10px 0; background: #f9fafb; border-radius: 0 6px 6px 0;">
          <span style="font-size: 11px; font-weight: 600; color: ${badgeColour}; text-transform: uppercase; letter-spacing: 0.05em;">${label}</span>
          <p style="margin: 4px 0 2px; font-weight: 600; color: #1e293b;">${item.title}</p>
          <p style="margin: 0; color: #475569; font-size: 14px;">${item.message}</p>
        </div>
      `;
    })
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0F3D7C; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <span style="color: white; font-size: 18px; font-weight: 700;">KEEP<span style="color: #F97316;">ME</span>ISO.COM</span>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Hello ${name},</p>
        <p>You have ${items.length} item${items.length === 1 ? '' : 's'} requiring your attention on the compliance platform:</p>
        ${itemsHtml}
        <p style="margin-top: 24px;">
          <a href="${loginUrl}" style="display: inline-block; background: #0F3D7C; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            View in Keep Me ISO
          </a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
          You are receiving this because you have active compliance obligations assigned to you.
        </p>
      </div>
    </div>
  `;

  const text = [
    'Keep Me ISO — Action Required',
    '',
    `Hello ${name},`,
    '',
    `You have ${items.length} item(s) requiring your attention:`,
    '',
    ...items.map((i) => `• ${i.title}: ${i.message}`),
    '',
    `Sign in at: ${loginUrl}`,
  ].join('\n');

  try {
    await client.emails.send({
      from: env.emailFrom,
      to,
      subject: `Keep Me ISO – ${items.length} item${items.length === 1 ? '' : 's'} require your attention`,
      html,
      text,
    });
  } catch (err: any) {
    console.error('Failed to send notification digest email:', err.message);
  }
}
