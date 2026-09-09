import { Resend } from 'resend';

// Resend's shared sandbox sender — works without owning/verifying a custom
// domain, which this project doesn't have. Fine for a capstone; a real
// business would verify its own domain instead.
const FROM = 'Rent-a-Ride Albay <onboarding@resend.dev>';

const PURPOSE_COPY = {
  register: { heading: 'Verify your email', body: 'Enter this code to finish creating your Rent-a-Ride Albay account:' },
  'change-password': { heading: 'Confirm your password change', body: 'Enter this code to confirm changing your password:' },
  'reset-password': { heading: 'Reset your password', body: 'Enter this code to reset your Rent-a-Ride Albay password:' },
};

export async function sendVerificationCodeEmail(email, code, purpose = 'register') {
  // Built lazily, not at module load — the Resend SDK throws synchronously
  // if the key is missing, and this file is imported at server startup, so
  // building it eagerly would crash the entire app over one missing env
  // var instead of just failing this one request.
  const resend = new Resend(process.env.RESEND_API_KEY);
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.register;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${code} is your Rent-a-Ride Albay code`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${copy.heading}</h2>
        <p style="color: #4b5563; font-size: 14px;">${copy.body}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #b8790a; margin: 20px 0;">${code}</div>
        <p style="color: #9ca3af; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}
