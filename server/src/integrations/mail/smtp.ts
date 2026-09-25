import tls from 'node:tls';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';

function configured() {
  return Boolean(env.smtpUser && env.smtpAppPassword);
}

function encode(lines: string[]) {
  return `${lines.join('\r\n')}\r\n`;
}

export async function sendMail(input: { to: string; subject: string; text: string; html?: string }) {
  if (!configured()) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'Email delivery is unavailable.');
  }

  const host = env.smtpHost;
  const port = env.smtpPort;
  const user = env.smtpUser;
  const pass = env.smtpAppPassword.replace(/\s+/g, '');
  const from = env.smtpFrom || user;

  await new Promise<void>((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => {
      let buffer = '';
      let step = 0;
      const send = (line: string) => socket.write(`${line}\r\n`);
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        const parts = buffer.split(/\r?\n/);
        buffer = parts.pop() || '';
        for (const raw of parts) {
          const line = raw.trim();
          if (!/^\d{3}([\s-].*)?$/.test(line)) continue;
          const code = Number(line.slice(0, 3));
          const more = line[3] === '-';
          if (more) continue;
          try {
            if (step === 0 && code >= 200 && code < 400) { send(`EHLO eiop.local`); step = 1; }
            else if (step === 1 && code >= 200 && code < 400) { send('AUTH LOGIN'); step = 2; }
            else if (step === 2 && code === 334) { send(Buffer.from(user).toString('base64')); step = 3; }
            else if (step === 3 && code === 334) { send(Buffer.from(pass).toString('base64')); step = 4; }
            else if (step === 4 && code === 235) { send(`MAIL FROM:<${from}>`); step = 5; }
            else if (step === 5 && code >= 200 && code < 400) { send(`RCPT TO:<${input.to}>`); step = 6; }
            else if (step === 6 && code >= 200 && code < 400) { send('DATA'); step = 7; }
            else if (step === 7 && code === 354) {
              const boundary = 'eiop-otp';
              const body = input.html ? [
                `From: Everything IOP <${from}>`,
                `To: ${input.to}`,
                `Subject: ${input.subject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/alternative; boundary=${boundary}`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=UTF-8',
                '',
                input.text,
                `--${boundary}`,
                'Content-Type: text/html; charset=UTF-8',
                '',
                input.html,
                `--${boundary}--`,
                '.',
              ] : [
                `From: Everything IOP <${from}>`,
                `To: ${input.to}`,
                `Subject: ${input.subject}`,
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
                '',
                input.text,
                '.',
              ];
              socket.write(encode(body));
              step = 8;
            } else if (step === 8 && code >= 200 && code < 400) { send('QUIT'); step = 9; }
            else if (step === 9) { socket.end(); resolve(); }
            else if (code >= 400) { socket.end(); reject(new Error(`SMTP ${code}`)); }
          } catch (error) {
            reject(error);
          }
        }
      });
    });
    socket.setTimeout(20_000, () => {
      socket.destroy();
      reject(new Error('SMTP timeout'));
    });
    socket.on('error', reject);
  }).catch((error) => {
    logger.error('mail_send_failed');
    throw new AppError(502, 'MAIL_FAILED', 'Could not send email right now.');
  });
}

export function mailConfigured() {
  return configured();
}
