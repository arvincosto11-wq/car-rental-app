import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Getting mail out of this system.
//
// Three routes, tried in order, each used only if it has been configured.
// Which one is live is decided entirely by what is set on the server, so a
// business can change provider without a line of code being touched:
//
//   1. Brevo, over the web. A single sender address is verified — no domain
//      needed — and after that it delivers to ANYONE. That is the whole
//      point: a customer signing up with their own address has to receive
//      their code.
//
//   2. Gmail, over the mail protocol. Present because it works on most
//      hosts, but NOT on Render, which blocks outbound mail connections
//      entirely. Leave it unconfigured there.
//
//   3. Resend's shared sandbox sender, as a fallback. Without a verified
//      domain it reaches exactly one inbox — the one that owns the Resend
//      account — and turns every other recipient away. That is the
//      provider's rule for unverified senders, not a limit of this system.
//
// When the business buys a domain, they verify it with a provider and send
// from bookings@their-domain. That is a settings change; nothing here needs
// rewriting for it.

const RESEND_FROM = 'Rent-a-Ride Albay <onboarding@resend.dev>';
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

// The address Brevo sends as. It has to be one verified in that account, or
// Brevo refuses the send.
const senderEmail = () => process.env.BREVO_SENDER_EMAIL || 'testrentaridealbay@gmail.com';
const senderName = () => process.env.BREVO_SENDER_NAME || 'Rent-a-Ride Albay';

const brevoConfigured = () => !!process.env.BREVO_API_KEY;
// An app password, not the account's real one: issued for a single
// application and revocable on its own, so it never gives away the mailbox.
const gmailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

async function sendViaBrevo({ to, subject, html }) {
  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName(), email: senderEmail() },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    // Without this a stalled connection holds the whole request open, and
    // whoever is waiting watches a button spin with nothing to act on.
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
}

async function sendViaGmail({ to, subject, html }) {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    // A bad credential or a blocked port doesn't fail on its own — it
    // hangs. Ten seconds is far longer than a working send needs.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.GMAIL_USER,
      // Google shows the app password in four blocks of four; the spaces
      // are for reading it, not part of it, and leaving them in is the most
      // common reason a correct password is rejected.
      pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
    },
  });

  try {
    await transport.sendMail({ from: `${senderName()} <${process.env.GMAIL_USER}>`, to, subject, html });
  } finally {
    // A transport left open holds the request open with it.
    transport.close();
  }
}

async function sendViaResend({ to, subject, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  // The SDK reports a rejected send by RETURNING an error rather than
  // throwing one. Ignoring that made a refusal look exactly like a success:
  // the account was told the code had been sent, the code was stored
  // against an address it never reached, and nothing said why.
  const { error } = await resend.emails.send({ from: RESEND_FROM, to, subject, html });
  if (error) throw new Error(`${error.name}: ${error.message}`);
}

// Every route in preference order, skipping the ones with no credentials.
const routes = () => [
  brevoConfigured() && { name: 'Brevo', send: sendViaBrevo },
  gmailConfigured() && { name: 'Gmail', send: sendViaGmail },
  process.env.RESEND_API_KEY && { name: 'Resend', send: sendViaResend },
].filter(Boolean);

// One send, through whichever route answers first. Throws only once every
// configured route has refused, and logs each refusal in the provider's own
// words — the reason a message didn't arrive belongs somewhere findable.
export async function sendEmail({ to, subject, html }) {
  const available = routes();
  // Nothing set up at all is a different problem from a send that failed,
  // and blaming the address for it would send someone hunting a typo that
  // was never there. This is the normal state when running locally.
  if (!available.length) {
    throw new Error('Email is not set up on this server, so nothing could be sent.');
  }

  const refusals = [];
  for (const route of available) {
    try {
      await route.send({ to, subject, html });
      return;
    } catch (err) {
      refusals.push(`${route.name}: ${err.message}`);
    }
  }

  console.error(`Email to ${to} failed. ${refusals.join(' | ')}`);
  throw new Error('We could not send an email to that address. Please check it and try again.');
}

// ---- what the messages look like ----

const shell = (inner) => `
  <div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; color: #1a1a1a;">
    ${inner}
    <p style="color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 26px;">
      Rent-a-Ride Albay · Legazpi City
    </p>
  </div>
`;

const PURPOSE_COPY = {
  register: { heading: 'Verify your email', body: 'Enter this code to finish creating your Rent-a-Ride Albay account:' },
  'change-password': { heading: 'Confirm your password change', body: 'Enter this code to confirm changing your password:' },
  'reset-password': { heading: 'Reset your password', body: 'Enter this code to reset your Rent-a-Ride Albay password:' },
  // Sent to the NEW address, never the old one — the point of the code is
  // to prove whoever asked can actually receive mail there.
  'change-email': { heading: 'Confirm your new email address', body: 'Enter this code to start using this address for your Rent-a-Ride Albay account:' },
};

export async function sendVerificationCodeEmail(email, code, purpose = 'register') {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.register;
  await sendEmail({
    to: email,
    subject: `${code} is your Rent-a-Ride Albay code`,
    html: shell(`
      <h2 style="color: #1a1a1a;">${copy.heading}</h2>
      <p style="color: #4b5563; font-size: 14px;">${copy.body}</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #b8790a; margin: 20px 0;">${code}</div>
      <p style="color: #9ca3af; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    `),
  });
}

// The email that goes with a notification worth knowing about away from the
// site. Deliberately the same title and wording that appears in the client's
// notification bell — two versions of one event, worded differently, is how
// somebody ends up unsure which is true.
export async function sendNotificationEmail({ to, title, message, link }) {
  const url = `${process.env.CLIENT_URL || 'https://rent-a-ride-albay.vercel.app'}${link || '/my-bookings'}`;
  await sendEmail({
    to,
    subject: title,
    html: shell(`
      <h2 style="color: #1a1a1a; font-size: 19px;">${title}</h2>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">${message}</p>
      <a href="${url}" style="display: inline-block; margin-top: 18px; padding: 11px 22px; background: #b8790a; color: #17130e; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px;">
        View my bookings
      </a>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
        You're receiving this because you have a booking with Rent-a-Ride Albay.
      </p>
    `),
  });
}
