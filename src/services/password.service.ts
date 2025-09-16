
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from 'generated/prisma';
import { sendPasswordResetEmail } from './email.service';

const prisma = new PrismaClient();

export const forgotPasswordService = async (email: string) => {
    const user = await prisma.user.findUnique({
        where: { email },
    });
    if (!user) {
        throw new Error('User not found.');
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000);
    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordResetToken: resetToken,
            passwordResetExpiresAt: resetExpires,
        },
    });
    await sendPasswordResetEmail(user.email, resetToken);
    return 'Password reset email sent.';
};

export const changePasswordService = async (userId: string, newPassword: string) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: {
            password: hashedPassword,
            forcePasswordChange: false,
        },
    });
    return 'Password has been reset successfully!';
};

export const resetPasswordService = async (token: string, newPassword: string) => {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new Error('Invalid or expired token.');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      forcePasswordChange: false, 
    },
  });

  return 'Password has been reset successfully.';
};
