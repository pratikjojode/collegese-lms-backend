import prisma from '../config/db';
import { hashPassword, comparePassword, generateToken, sendVerificationEmail, generateLMSId } from '../utils/auth.utils';
import { Prisma } from '../generated/prisma';
import jwt from 'jsonwebtoken';
import { uploadPublicFileToS3 } from '../utils/s3.utils';


export const registerUserService = async (userData: Prisma.UserCreateInput, profilePicFile: Express.Multer.File | undefined) => {
  const { password, email, ...rest } = userData;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('Email already registered.');
  }

  let profilePicUrl: string | undefined = undefined;
  if (profilePicFile) {
    try {
      profilePicUrl = await uploadPublicFileToS3(
        profilePicFile.buffer,
        profilePicFile.mimetype,
        `profile-pics/${Date.now()}-${profilePicFile.originalname}`
      );
    } catch (error) {
      console.error("Failed to upload profile picture to S3:", error);
      throw new Error('Failed to upload profile picture.');
    }
  }

  const hashedPassword = await hashPassword(password);
  const verificationToken = generateToken({ email });
  const collegeseLmsId = generateLMSId();

  const newUser = await prisma.user.create({
    data: {
      ...rest,
      email,
      password: hashedPassword,
      profilePic: profilePicUrl,
      collegese_lms_id: collegeseLmsId,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  await sendVerificationEmail(email, verificationToken);

  return newUser;
};

export const loginUserService = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await comparePassword(password, user.password))) {
    throw new Error('Invalid email or password.');
  }

  if (!user.isVerified) {
    throw new Error('Account is not verified. Please check your email for the verification link.');
  }

  const authToken = generateToken({ 
    id: user.id, 
    email: user.email, 
    role: user.role, 
    forcePasswordChange: user.forcePasswordChange 
  });
  return { user, token: authToken };
};

export const verifyEmailService = async (token: string) => {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          verificationToken: token,
          verificationTokenExpiresAt: { gt: new Date() },
        },
      });

      if (!user) {
        throw new Error("Invalid or expired verification token.");
      }

      if (user.isVerified) {
        throw new Error("Email is already verified.");
      }

      await tx.user.update({
        where: { 
          id: user.id,
          verificationToken: token
        },
        data: {
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiresAt: null,
        },
      });
    });

    return "Email verified successfully!";
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("This verification link has already been used.");
    }
    
    if (error.message?.includes("Invalid or expired") || error.message?.includes("already verified")) {
      throw error;
    }
    
    throw new Error("Verification failed.");
  }
};
