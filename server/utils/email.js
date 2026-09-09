import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Resend's shared sandbox sender — works without owning/verifying a custom
// domain, which this project doesn't have. Fine for a capstone; a real
// business would verify its own domain instead.
const FROM = 'Rent-a-Ride Albay <onboarding@resend.dev>';

export async function sendVerificationCodeEmail(email, code) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${code} is your Rent-a-Ride Albay verification code`,
    html: `
      <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Verify your email</h2>
        <p style="color: #4b5563; font-size: 14px;">Enter this code to finish creating your Rent-a-Ride Albay account:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #b8790a; margin: 20px 0;">${code}</div>
        <p style="color: #9ca3af; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}
