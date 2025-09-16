import { Request, Response } from 'express';
import prisma from '../../config/db'; 
import { uploadPublicFileToS3 } from 'utils/s3.utils';
import { NotificationService } from '../../services/notification.service';


const filterCourseUpdateData = (data: any) => {
  const allowedFields = ['title', 'description', 'thumbnailUrl', 'startDate', 'endDate', 'isPublished'];
  const updateData: any = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      updateData[key] = data[key];
    }
  }
  if (data.isPublished !== undefined && typeof data.isPublished === 'boolean') {
    updateData.isPublished = data.isPublished;
  }
  return updateData;
};


export const createCourseController = async (req: Request, res: Response) => {
  try {
    const { title, description, startDate, endDate, isPublished } = req.body;
    const user = (req as any).user;

    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Course title is required." });
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can create courses.",
      });
    }

    
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please login again.",
      });
    }

    let thumbnailUrl: string | undefined;
    if (req.file) {
      thumbnailUrl = await uploadPublicFileToS3(
        req.file.buffer,
        req.file.mimetype,
        `course-thumbnails/${Date.now()}-${req.file.originalname}`
      );
    }

    const isPublishedBoolean = isPublished === "true";

    const newCourse = await prisma.course.create({
      data: {
        title,
        description,
        thumbnailUrl,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isPublished: isPublishedBoolean,
        createdBy: {
          connect: { id: user.id },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Course created successfully.",
      course: newCourse,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create course.", error });
  }
};

export const getAllCoursesController = async (req: Request, res: Response) => {
  try {
    const courses = await prisma.course.findMany({
      where: {
        isDeleted: false, 
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch courses.' });
  }
};

export const getCourseByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!course || course.isDeleted) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    res.status(200).json({ success: true, course });
  } catch (error) {
    console.error("Error fetching course:", error);
    res.status(500).json({ success: false, message: 'Failed to fetch course.' });
  }
};


export const getEnrolledUsersCountController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const enrolledUsersCount = await prisma.courseEnrollment.count({
      where: {
        courseId: courseId,
      },
    });

    res.status(200).json({ 
      success: true, 
      courseId, 
      enrolledUsersCount 
    });
  } catch (error) {
    res.status(500).json({
      success: false, 
      message: 'Failed to retrieve enrolled user count.',
      error: error
    });
  }
};

export const updateCourseController = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

   
   const updateData: any = {
  title: req.body.title,
  description: req.body.description,
  startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
  endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
  isPublished: req.body.isPublished === 'true',
};

Object.keys(updateData).forEach(
  (key) => (updateData[key] === undefined || updateData[key] === '') && delete updateData[key]
);


    
    if (req.file) {
      const fileBuffer = req.file.buffer; 
      const mimetype = req.file.mimetype;
      const key = `courses/${Date.now()}_${req.file.originalname}`;
      const fileUrl = await uploadPublicFileToS3(fileBuffer, mimetype, key);
      updateData.thumbnailUrl = fileUrl;
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully.',
      course: updatedCourse,
    });
  } catch (error: any) {
    console.error(error);
    res.status(400).json({
      success: false,
      message: 'Failed to update course.',
      error: error.message,
    });
  }
};


export const deleteCourseController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.course.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
        isPublished: false,
      },
    });

    res.status(200).json({ success: true, message: 'Course soft-deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete course.', error });
  }
};

export const enrollStudentController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { studentEmail } = req.body; 

    
    const student = await prisma.user.findUnique({
      where: { email: studentEmail },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found." });
    }

    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: student.id,
          courseId: courseId,
        },
      },
    });

    if (existingEnrollment) {
      return res
        .status(400)
        .json({ success: false, message: "User is already enrolled in this course." });
    }

    const newEnrollment = await prisma.courseEnrollment.create({
      data: {
        userId: student.id, 
        courseId: courseId,
      },
    });

    res
      .status(201)
      .json({ success: true, message: "Successfully enrolled in course.", enrollment: newEnrollment });
  } catch (error) {
    console.error("❌ Enrollment error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to enroll in course.", error });
  }
};


export const getCourseForEnrolledUserController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = (req as any).user.id;

    console.log('Debug - userId:', userId);
    console.log('Debug - courseId:', courseId);
    console.log('Debug - userId type:', typeof userId);
    console.log('Debug - courseId type:', typeof courseId);

    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        userId,
        courseId,
      },
    });

    console.log('Debug - enrollment found:', !!enrollment);

    if (!enrollment) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You are not enrolled in this course.' 
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          select: { id: true, title: true },
        },
        enrollments: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found.' 
      });
    }

    res.status(200).json({ success: true, course });
  } catch (error) {
    console.error('Error in getCourseForEnrolledUserController:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve course details.' 
    });
  }
};


export const getMyCoursesController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User ID not found.' });
    }

    const myCourses = await prisma.courseEnrollment.findMany({
      where: {
        userId: userId,
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            isPublished: true,
          },
        },
      },
    });
    const courses = myCourses
      .filter(e => e.course !== null)
      .map(e => e.course);

    res.status(200).json({ success: true, courses });
  } catch (error: unknown) {
    console.error("Error retrieving user courses:", error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user courses.' });
  }
};

export const getCurrentUserCoursesController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

   const courses = await prisma.course.findMany({
  where: {
    OR: [
      { createdById: userId },
      { enrollments: { some: { userId } } }
    ],
    isDeleted: false,
    isPublished: true,
  },
  select: {
    id: true,
    title: true,
    description: true,
    thumbnailUrl: true,
    isPublished: true,
    startDate: true, 
    endDate: true,   
    createdBy: {
      select: { id: true, name: true, email: true }
    },
    enrollments: {
      select: {
        userId: true,
        status: true,
        enrolledAt: true,
        progress: true,
      }
    }
  }
});

const formattedCourses = courses.map(course => {
  const myEnrollment = course.enrollments.find(e => e.userId === userId);

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    isPublished: course.isPublished,
    createdBy: course.createdBy,
    isEnrolled: !!myEnrollment,
    enrollmentStatus: myEnrollment?.status || null,
    enrollmentDate: myEnrollment?.enrolledAt || null,
    progress: myEnrollment?.progress ?? 0,
    startDate: course.startDate || null, 
    endDate: course.endDate || null,
  };
});



    res.status(200).json({
      success: true,
      courses: formattedCourses
    });

  } catch (error) {
    console.error("❌ Error fetching user courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user courses."
    });
  }
};

export const enrollUserByEmailController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }


    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: courseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, message: "User is already enrolled in this course" });
    }

    const newEnrollment = await prisma.courseEnrollment.create({
      data: {
        userId: user.id,
        courseId: courseId,
      },
    });

    res.status(201).json({
      success: true,
      message: `User ${user.name} has been enrolled successfully`,
      enrollment: newEnrollment,
    });
  } catch (error) {
    console.error("Enroll by email error:", error);
    res.status(500).json({ success: false, message: "Failed to enroll user", error });
  }
};

export const selfEnrollController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = (req as any).user.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User ID not found.' });
    }

    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ success: false, message: 'You are already enrolled in this course.' });
    }

    const newEnrollment = await prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
      },
    });

    res.status(201).json({ success: true, message: 'Successfully enrolled in course.', enrollment: newEnrollment });
  } catch (error) {
    console.error('Error in selfEnrollController:', error);
    res.status(500).json({ success: false, message: 'Failed to enroll in course.', error });
  }
};

export const enrollUserByIdController = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId, isDeleted: false, isPublished: true }
    });

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found or not available for enrollment.' 
      });
    }

    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false, 
        message: `User ${user.name || user.email} is already enrolled in this course.` 
      });
    }

    const newEnrollment = await prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
        status: "IN_PROGRESS",
        progress: 0
      },
    });

    res.status(201).json({ 
      success: true, 
      message: `User ${user.name || user.email} successfully enrolled in course.`, 
      enrollment: newEnrollment 
    });
  } catch (error) {
    console.error('Error in enrollUserByIdController:', error);
    res.status(500).json({ success: false, message: 'Failed to enroll user in course.', error });
  }
};

export const getTeacherAssignedCoursesController = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

       
        const assignments = await prisma.courseTeacher.findMany({
            where: {
                teacherId: userId,
            },
            include: {
                course: true,
            },
        });

        const validCourses = assignments
            .filter((assignment: { course: { isDeleted: any; }; }) => assignment.course && !assignment.course.isDeleted)
            .map((assignment: { course: any; }) => assignment.course);

        res.status(200).json({ success: true, courses: validCourses });
    } catch (error) {
        console.error("Failed to fetch assigned courses:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch assigned courses.' });
    }
};

export const assignTeacherToCourseController = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;
        const { teacherId } = req.body;
        const user = (req as any).user; 
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can assign teachers to courses.'
            });
        }
        const teacherUser = await prisma.user.findFirst({ 
            where: { id: teacherId, role: 'TEACHER' } 
        });
        if (!teacherUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'User is not a Teacher or does not exist.' 
            });
        }
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, title: true }
        });
        if (!course) {
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found.' 
            });
        }
        const existingAssignment = await prisma.courseTeacher.findFirst({
            where: { courseId, teacherId }
        });
        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'Teacher is already assigned to this course.'
            });
        }
        await prisma.courseTeacher.create({
            data: { courseId, teacherId }
        });
        await NotificationService.notifyTeacherCourseAssignment(
            teacherId,
            courseId,
            course.title,
            user.name || 'Administrator',
            {
                assignedById: user.id,
                courseDescription: `You have been assigned to teach this course by ${user.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'}.`,
            }
        );

        res.status(200).json({
            success: true,
            message: 'Teacher has been assigned to the course and notified.'
        });
    } catch (error) {
        console.error('Error assigning teacher to course:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to assign teacher to course.' 
        });
    }
};

export const removeTeacherFromCourseController = async (req: Request, res: Response) => {
    try {
        const { courseId, teacherId } = req.params;
        const user = (req as any).user;
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can remove teachers from courses.'
            });
        }
        const assignment = await prisma.courseTeacher.findFirst({
            where: { courseId, teacherId }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Teacher is not assigned to this course.'
            });
        }

        await prisma.courseTeacher.delete({
            where: { id: assignment.id }
        });

        res.status(200).json({
            success: true,
            message: 'Teacher has been removed from the course.'
        });
    } catch (error) {
        console.error('Error removing teacher from course:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to remove teacher from course.' 
        });
    }
};