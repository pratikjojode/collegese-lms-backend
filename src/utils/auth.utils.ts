import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
const JWT_SECRET = process.env.JWT_SECRET as string;
const EMAIL_USER = process.env.EMAIL_USER as string;
const EMAIL_PASS = process.env.EMAIL_PASS as string;
const EMAIL_HOST = process.env.EMAIL_HOST as string;
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT as string, 10);

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in the environment variables.');
}

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const generateLMSId = (): string => {
    const prefix = 'LMS-';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    const bytes = crypto.randomBytes(12); 
    for (let i = 0; i < 12; i++) {
        result += characters[bytes[i] % charactersLength];
    }
    return `${prefix}${result}`;
};

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

export const sendVerificationEmail = async (toEmail: string, token: string): Promise<void> => {
  const mailOptions = {
    from: `"CollegeEse LMS" <${EMAIL_USER}>`,
    to: toEmail,
    subject: 'Email Verification',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 1px solid #eeeeee; padding-bottom: 20px; }
          .header h1 { color: #0056b3; margin: 0; }
          .content { padding-top: 20px; }
          .content h2 { color: #333333; }
          .footer { text-align: center; font-size: 12px; color: #777; padding-top: 20px; border-top: 1px solid #eeeeee; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 Collegese LMS</h1>
          </div>
          <div class="content">
            <h2>Email Verification</h2>
            <p>Hello,</p>
            <p>Welcome to Collegese LMS! We're excited to have you on board.</p>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5000/api/v1/auth/verify-email?token=${token}"
                 style="background-color: #0056b3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; transition: background-color 0.3s;">
                  Verify Email
              </a>
            </div>
            <p style="color: #d32f2f; font-weight: bold;">⚠️ This link will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <hr style="border: none; height: 1px; background-color: #eeeeee; margin: 20px 0;">
            <p>Best regards,<br>The Collegese Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Collegese LMS. All Rights Reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error('Failed to send verification email.');
  }
};
