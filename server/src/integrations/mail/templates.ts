export function otpEmail(purpose: 'signup' | 'recovery', code: string) {
  const isSignup = purpose === 'signup';
  const subject = isSignup
    ? `EIOP verification code: ${code}`
    : `EIOP password reset code: ${code}`;

  const text = [
    'Everything IOP',
    '',
    isSignup
      ? 'Use this code to verify your email and finish creating your account.'
      : 'Use this code to reset your Everything IOP password.',
    '',
    `Code: ${code}`,
    '',
    'This code expires in 10 minutes and can be used once.',
    'Do not share it with anyone. EIOP staff will never ask for this code.',
    '',
    isSignup
      ? 'After you verify and set a password, you will need to log in once to confirm the account.'
      : 'If you did not ask for a reset, you can ignore this email. Your password stays the same.',
    '',
    '— EIOP',
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4efe6;font-family:Georgia,serif;color:#1c1915">
  <div style="max-width:520px;margin:24px auto;background:#fffaf3;border:1px solid #e4d9c8;padding:28px 28px 32px">
    <p style="letter-spacing:.18em;font-size:11px;text-transform:uppercase;color:#8a7048;margin:0 0 8px">Everything IOP</p>
    <h1 style="font-size:22px;margin:0 0 16px">Your code</h1>
    <p style="line-height:1.55;margin:0 0 16px">${isSignup
      ? 'Use this code to verify your email and finish creating your account.'
      : 'Use this code to reset your password.'}</p>
    <p style="font-size:32px;letter-spacing:.28em;margin:0 0 16px;font-family:ui-monospace,monospace">${code}</p>
    <p style="line-height:1.55;margin:0 0 8px">Expires in 10 minutes. One-time use. Do not share it.</p>
    <p style="line-height:1.55;margin:0;color:#6b6358">${isSignup
      ? 'After you set a password, log in once to confirm the account.'
      : 'If you did not request this, ignore the email.'}</p>
  </div>
</body></html>`;

  return { subject, text, html };
}
