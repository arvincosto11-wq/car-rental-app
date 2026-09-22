import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Sending the verification codes this system runs on.
//
// Two routes, tried in that order:
//
//   1. The business's own Gmail, through an app password. Gmail already
//      knows that mailbox is real, so it will deliver to ANYONE — which is
//      the only thing that matters here, because a customer signing up with
//      their own address has to receive their code.
//
//   2. Resend's shared sandbox sender, kept as a fallback. Without a
//      verified domain it delivers to exactly one inbox — the one that owns
//      the Resend account — and turns every other recipient away. That is
//      Resend's rule for unverified senders, not a limit of this system,
//      and it is why route 1 exists.
//
// A business that later buys a domain verifies it with a provider and sends
// from bookings@their-domain instead. That is a settings change; nothing
// here has to be touched for it.

// Resend's shared sender, usable without owning a domain.
const RESEND_FROM = 'Rent-a-Ride Albay <onboarding@resend.dev>';

const PURPOSE_COPY = {
  register: { heading: 'Verify your email', body: 'Enter this code to finish creating your Rent-a-Ride Albay account:' },
  'change-password': { heading: 'Confirm your password change', body: 'Enter this code to confirm changing your password:' },
  'reset-password': { heading: 'Reset your password', body: 'Enter this code to reset your Rent-a-Ride Albay password:' },
  // Sent to the NEW address, never the old one — the point of the code is
  // to prove whoever asked can actually receive mail there.
  'change-email': { heading: 'Confirm your new email address', body: 'Enter this code to start using this address for your Rent-a-Ride Albay account:' },
};

const subjectFor = (code) => `${code} is your Rent-a-Ride Albay code`;

const bodyFor = (code, purpose) => {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.register;
  return `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${copy.heading}</h2>
        <p style="color: #4b5563; font-size: 14px;">${copy.body}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #b8790a; margin: 20px 0;">${code}</div>
        <p style="color: #9ca3af; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `;
};

// An app password, not the account's real one. Google issues it for a single
// application and it can be revoked on its own, so it never gives away the
// mailbox itself. It belongs in the server's settings and nowhere else —
// never in the code, never in the repository.
const gmailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

async function sendViaGmail(email, code, purpose) {
  const transport = nodemailer.createTransport({
    service: 'gmail',
    // Without these a bad credential or a blocked port doesn't fail — it
    // hangs, and the person waiting watches a button say "Sending..."
    // forever with nothing to act on. Ten seconds is far longer than a
    // working send needs and short enough to fall through to the backup
    // while someone is still looking at the screen.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: {
      user: process.env.GMAIL_USER,
      // Google shows the app password in four blocks of four; the spaces are
      // for reading it, not part of it, and leaving them in is the most
      // common reason a correct password is rejected.
      pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
    },
  });

  // Released either way — a transport left open holds the request open with
  // it, which is the other way this ends up hanging.
  const closeAfter = (promise) => promise.finally(() => transport.close());

  await closeAfter(transport.sendMail({
    from: `Rent-a-Ride Albay <${process.env.GMAIL_USER}>`,
    to: email,
    subject: subjectFor(code),
    html: bodyFor(code, purpose),
  }));
}

async function sendViaResend(email, code, purpose) {
  if (!process.env.RESEND_API_KEY) throw new Error('No Resend API key is configured.');

  const resend = new Resend(process.env.RESEND_API_KEY);
  // The SDK reports a rejected send by RETURNING an error rather than
  // throwing one. Ignoring that made a refusal look exactly like a success:
  // the account was told "code sent", the code was stored against an
  // address it never reached, and nothing anywhere said why.
  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: email,
    subject: subjectFor(code),
    html: bodyFor(code, purpose),
  });
  if (error) throw new Error(`${error.name}: ${error.message}`);
}

export async function sendVerificationCodeEmail(email, code, purpose = 'register') {
  // Nothing set up at all is a different problem from a send that failed,
  // and blaming the address for it would send someone hunting a typo that
  // isn't there. This is the normal state when running the project locally.
  if (!gmailConfigured() && !process.env.RESEND_API_KEY) {
    throw new Error('Email is not set up on this server, so no code could be sent.');
  }

  const attempts = [];

  if (gmailConfigured()) {
    try {
      await sendViaGmail(email, code, purpose);
      return;
    } catch (err) {
      // Not fatal on its own. An app password dies if the account's real
      // password changes or two-step verification is switched off, and a
      // client waiting on a code shouldn't be the one who finds that out.
      attempts.push(`Gmail: ${err.message}`);
    }
  }

  try {
    await sendViaResend(email, code, purpose);
    return;
  } catch (err) {
    attempts.push(`Resend: ${err.message}`);
  }

  console.error(`Verification email to ${email} failed. ${attempts.join(' | ')}`);
  throw new Error('We could not send the code to that address. Please check it and try again.');
}
