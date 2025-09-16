import { Request, Response } from 'express';
import prisma from '../config/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateLMSId, sendVerificationEmail } from '../utils/auth.utils';
import { Prisma } from '../generated/prisma';

export const createUserHandler = async (userData: any) => {
  const { email, password, name, role, ...rest } = userData;
  
  if (!email || !name) {
    throw new Error('Email and name are required.');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists.');
  }

  const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const lmsId = generateLMSId();

  const newUser = await prisma.user.create({
    data: {
      ...rest,
      email,
      name,
      role: role ? (role.toUpperCase() as Prisma.UserCreateInput['role']) : 'STUDENT',
      password: hashedPassword,
      collegese_lms_id: lmsId,
      verificationToken,
      verificationTokenExpiresAt,
      isVerified: false,
      forcePasswordChange: true,
    },
  });

  await sendVerificationEmail(newUser.email, newUser.verificationToken as string);
  
  return newUser;
};

export const createUserController = async (req: Request, res: Response) => {
  try {
    const newUser = await createUserHandler(req.body);
    const { password, verificationToken, verificationTokenExpiresAt, ...userResponse } = newUser;
    res.status(201).json({ success: true, message: 'User created successfully.', user: userResponse });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to create user.' });
  }
};

export const getAllUsersController = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

export const getUserByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id, isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        collegese_lms_id: true,
        role: true,
        isSuspended: true,
        isVerified: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
};

export const updateUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

 
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
      if (isNaN(updateData.dateOfBirth.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD.",
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password, ...userResponse } = updatedUser;

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      user: userResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update user.",
    });
  }
};


export const deleteUserController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        isSuspended: true,
      },
    });
    
    res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
};

export const getAllSessionsController = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        loginTime: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve all sessions.',
    });
  }
};

export const getAdminEnrollmentsController = async (req: Request, res: Response) => {
  try {
   
    const enrollments = await prisma.courseEnrollment.findMany({
      include: {
        course: true,
      },
    });

    
    const userIds = enrollments.map(e => e.userId);
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
    });

    
    const enrollmentsWithUsers = enrollments.map(e => ({
      ...e,
      user: users.find(u => u.id === e.userId) || null,
    }));

    res.status(200).json({
      success: true,
      enrollments: enrollmentsWithUsers,
    });
  } catch (error) {
    console.error("❌ Error fetching all enrollments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all enrollments.",
    });
  }
};

export const assignTeacherToCourseController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const { teacherId } = req.body;
        const existingAssignment = await prisma.courseTeacher.findFirst({
            where: { courseId, teacherId },
        });
        if (existingAssignment) {
            return res.status(400).json({ success: false, message: 'Teacher is already assigned to this course.' });
        }
        await prisma.courseTeacher.create({
            data: {
                courseId,
                teacherId,
            },
        });  
        res.status(200).json({ success: true, message: 'Teacher assigned successfully.' });
    } catch (error) {
        console.error("Failed to assign teacher:", error);
        res.status(500).json({ success: false, message: 'Failed to assign teacher.' });
    }
};

export const findUserByEmailController = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, name: true, email: true, role: true }, 
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An error occurred while searching for the user.' });
    }
};

export const getAssignedTeachersController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const assignments = await prisma.courseTeacher.findMany({
            where: { courseId: courseId },
            select: {
                teacher: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!assignments) {

            return res.status(404).json({ success: false, message: 'Course not found or no teachers assigned.' });
        }
        const teachers = assignments.map((assignment: { teacher: any; }) => assignment.teacher);

        res.status(200).json({ success: true, teachers: teachers });
    } catch (error) {
        console.error("Failed to fetch assigned teachers:", error)
        res.status(500).json({ success: false, message: 'Failed to fetch assigned teachers.' });
    }
};