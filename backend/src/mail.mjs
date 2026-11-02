import nodemailer from 'nodemailer';

export function createResetDelivery(config) {
  const transport = config.smtp ? nodemailer.createTransport({ ...config.smtp,
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  }) : null;
  return async (email, code) => {
    if (transport) {
      if (!config.smtpFrom) throw new Error('SMTP_FROM is required.');
      await transport.sendMail({ from: config.smtpFrom, to: email, subject: 'Your password reset code',
        text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.` });
    } else if (config.devLogResetCodes && !config.production) {
      console.log(`[DEVELOPMENT ONLY - NO EMAIL SENT] Password reset for ${email}: ${code} (expires in 10 minutes)`);
    } else throw new Error('Password reset email delivery is not configured.');
  };
}
