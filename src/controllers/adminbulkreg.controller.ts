import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';
import { generateLMSId, sendVerificationEmail as sendAuthVerificationEmail } from '../utils/auth.utils';
import { uploadPrivateFileToS3 } from '../utils/s3.utils';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const bulkRegisterUsers = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  let excelFileS3Url;
  try {
    try {
      excelFileS3Url = await uploadPrivateFileToS3(
        req.file.buffer,
        req.file.mimetype,
        `bulk-uploads/${Date.now()}-${req.file.originalname}`
      );
    } catch (uploadError) {
      console.error('S3 upload failed:', uploadError);
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const usersData = XLSX.utils.sheet_to_json(worksheet);

    const registeredUsers: string[] = [];
    const skippedUsers: string[] = [];
    const failedEmails: { email: string; error: string }[] = [];

    for (const userData of usersData as any[]) {
      const {
        email,
        name,
        role,
        phone,
        courseName,
        Gender,
        dateOfBirth,
        address,
        department,
        year,
        guardianPhone,
        attendancePercentage,
        grade,
        feedback,
      } = userData;

      if (!email || !name) {
        skippedUsers.push(JSON.stringify(userData));
        continue;
      }

      try {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          skippedUsers.push(email);
          continue;
        }

        const password = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);
        const lmsId = generateLMSId();
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const userRole =
          role && ['STUDENT', 'ADMIN', 'TEACHER', 'ASSISTANT', 'SUPER_ADMIN'].includes(role.toUpperCase())
            ? role.toUpperCase()
            : 'STUDENT';

        const newUser = await prisma.user.create({
          data: {
            email,
            name,
            collegese_lms_id: lmsId,
            password: hashedPassword,
            forcePasswordChange: true,
            isVerified: false,
            verificationToken,
            verificationTokenExpiresAt,
            role: userRole,
            phone,
            courseName,
            Gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            address,
            department,
            year: year ? parseInt(year) : undefined,
            guardianPhone,
            attendancePercentage: attendancePercentage ? parseFloat(attendancePercentage) : 0,
            grade,
            feedback,
          },
        });
        
        const course = await prisma.course.findFirst({
          where: {
            title: {
              contains: courseName,
              mode: 'insensitive',
            },
            isDeleted: false,
            isActive: true,
          },
        });

        if (course) {
          await prisma.courseEnrollment.create({
            data: {
              userId: newUser.id,
              courseId: course.id,
            },
          });
        } else {
          console.warn(`Course not found for: ${courseName}`);
        }

        await sendAuthVerificationEmail(email, verificationToken);

        await transporter.sendMail({
          from: `"Collegese LMS" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your new LMS account credentials',
          html: `
            <p>Welcome to Collegese LMS, ${name}!</p>
            <p>Your credentials:</p>
            <ul>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Password:</strong> ${password}</li>
              <li><strong>LMS ID:</strong> ${lmsId}</li>
              <li><strong>Enrolled Course:</strong> ${courseName}</li>
            </ul>
            <p>Please verify your email and change your password on first login.</p>
          `,
        });

        registeredUsers.push(email);
      } catch (userError: any) {
        failedEmails.push({
          email: email || 'Unknown Email',
          error: userError.message || 'Unknown Error',
        });
      }
    }

    return res.status(200).json({
      message: 'Bulk registration completed.',
      summary: {
        totalProcessed: usersData.length,
        registeredCount: registeredUsers.length,
        skippedCount: skippedUsers.length,
        failedEmailCount: failedEmails.length,
      },
      details: {
        registeredUsers,
        skippedUsers,
        failedEmails,
      },
      excelFileS3Url,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Internal server error during bulk registration.',
      error: error.message,
    });
  }
};
