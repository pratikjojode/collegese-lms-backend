import { Request, Response } from 'express';
import { PrismaClient } from 'generated/prisma';
import { uploadPublicFileToS3 } from 'utils/s3.utils';
import { uuidv4 } from 'zod';


const prisma = new PrismaClient();

export const getUserSessionsController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const sessions = await prisma.session.findMany({
      where: {
        userId: userId,
      },
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user sessions.',
    });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(200).json({ success: true, message: 'Already logged out.' });
    }

    await prisma.session.deleteMany({
      where: {
        token: token,
      },
    });

    res.clearCookie('auth_token');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to log out.',
    });
  }
};


export const logoutSessionByIdController = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    res.status(200).json({ success: true, message: 'Session logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to log out session.' });
  }
};

export const getUserSessionsByAdminController = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const sessions = await prisma.session.findMany({
      where: {
        userId: userId,
      },
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
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user sessions.',
    });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        collegese_lms_id: true,
        email: true,
        phone: true,
        profilePic: true,
        courseName: true,
        Gender: true,
        dateOfBirth: true,
        address: true,
        department: true,
        year: true,
        guardianPhone: true,
        attendancePercentage: true,
        grade: true,
        feedback: true,
        bio: true,
        role: true,
        completedCourse: true,
        isVerified: true,
        forcePasswordChange: true,
        isSuspended: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user profile." });
  }
};

export const updateUserProfileController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const body = req.body || {};
    const allowedFields = ["name", "email", "phone", "address"];
    const updateData: any = {};

    for (const key of allowedFields) {
      if (key in body) {
        updateData[key] = body[key];
      }
    }

    if (req.file) {
      const fileKey = `profile-pics/${userId}-${uuidv4()}-${req.file.originalname}`;
      const fileUrl = await uploadPublicFileToS3(req.file.buffer, req.file.mimetype, fileKey);
      updateData.profilePic = fileUrl;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const { password, ...userResponse } = updatedUser;
    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: userResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile.",
    });
  }
};

export const getQuizCompletionStatus = async (req:Request, res:Response) => {
 try {
   const { studentId, quizId } = req.params;

   const quiz = await prisma.quiz.findUnique({
     where: { id: quizId }
   });

   if (!quiz) {
     return res.status(404).json({ error: 'Quiz not found' });
   }

   const student = await prisma.user.findUnique({
     where: { id: studentId }
   });

   if (!student) {
     return res.status(404).json({ error: 'Student not found' });
   }

   const submission = await prisma.quizSubmission.findUnique({
     where: {
       userId_quizId: {
         userId: studentId,
         quizId: quizId
       }
     }
   });

   if (submission) {
     return res.status(200).json({
       completed: true,
       status: submission.status,
       score: submission.score,
       startTime: submission.startTime,
       endTime: submission.endTime,
       submittedAt: submission.submittedAt
     });
   } else {
     return res.status(200).json({
       completed: false,
       status: null
     });
   }

 } catch (error) {
   return res.status(500).json({ error: 'Internal server error' });
 }
};

export const getAssessmentCompletionStatus = async (req:Request, res:Response) => {
 try {
   const { studentId, assessmentId } = req.params;

   const assessment = await prisma.assessment.findUnique({
     where: { id: assessmentId }
   });

   if (!assessment) {
     return res.status(404).json({ error: 'Assessment not found' });
   }

   const student = await prisma.user.findUnique({
     where: { id: studentId }
   });

   if (!student) {
     return res.status(404).json({ error: 'Student not found' });
   }

   const submission = await prisma.assessmentSubmission.findUnique({
     where: {
       assessmentId_studentId: {
         assessmentId: assessmentId,
         studentId: studentId
       }
     }
   });

   if (submission) {
     return res.status(200).json({
       completed: true,
       status: submission.status,
       submittedAt: submission.submittedAt,
       grade: submission.grade,
       feedback: submission.feedback,
       gradedAt: submission.gradedAt
     });
   } else {
     return res.status(200).json({
       completed: false,
       status: 'NOT_SUBMITTED'
     });
   }

 } catch (error) {
   return res.status(500).json({ error: 'Internal server error' });
 }
};





