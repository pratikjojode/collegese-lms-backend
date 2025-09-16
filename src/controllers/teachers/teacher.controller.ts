import { Request, Response } from 'express';
import { PrismaClient } from 'generated/prisma';

const prisma = new PrismaClient();

export const getTeacherCourses = async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  if (!teacherId) {
    return res.status(400).json({ success: false, message: 'Teacher ID is required.' });
  }

  try {
    const courses = await prisma.courseTeacher.findMany({
      where: {
        teacherId: teacherId,
      },
      select: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            recordedLectures: {
              select: {
                id: true,
                title: true,
                duration: true,
                participants: {
                  select: {
                    userId: true,
                    progress: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const teacherCourses = courses.map((ct: { course: any; }) => ct.course);

    res.status(200).json({ success: true, courses: teacherCourses });
  } catch (error) {
    console.error('Error fetching teacher courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve courses due to a server error.',
    });
  }
};

export const getEnrolledStudentsCount = async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  if (!teacherId) {
    return res.status(400).json({ success: false, message: 'Teacher ID is required.' });
  }

  try {
    const coursesWithStudentCount = await prisma.course.findMany({
      where: {
        createdById: teacherId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });
    
    const formattedCourses = coursesWithStudentCount.map(course => ({
      id: course.id,
      title: course.title,
      description: course.description,
      totalStudents: course._count.enrollments,
    }));

    res.status(200).json({ success: true, courses: formattedCourses });
  } catch (error) {
    console.error('Error fetching student count for teacher courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student count due to a server error.',
    });
  }
};


export const getTeacherLectures = async (req: Request, res: Response) => {
  const { teacherId } = req.params;

  if (!teacherId) {
    return res.status(400).json({ success: false, message: 'Teacher ID is required.' });
  }

  try {
  
    const lectures = await prisma.recordedLecture.findMany({
      where: {
        OR: [
          { teacherId: teacherId },
          {
            course: {
              courseTeachers: {
                some: {
                  teacherId: teacherId
                }
              }
            }
          }, 
        ]
      },
      select: {
        id: true,
        title: true,
        videoUrl: true,
        courseId: true,
        duration: true,
        createdAt: true,
        teacherId: true, 
      },
    });

    res.status(200).json({ success: true, lectures });
  } catch (error) {
    console.error('Error fetching teacher lectures:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve lectures due to a server error.',
    });
  }
};

export const updateTeacherLecture = async (req: Request, res: Response) => {
  const { teacherId, lectureId } = req.params;
  const { title, videoUrl, duration } = req.body;

  if (!teacherId || !lectureId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Teacher ID and Lecture ID are required.' 
    });
  }

  try {
    const lectureToUpdate = await prisma.recordedLecture.findFirst({
      where: {
        id: lectureId,
        course: {
          teachers: {
            some: {
              teacherId: teacherId
            }
          }
        }
      }
    });

    if (!lectureToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found or you do not have permission to edit it.'
      });
    }

    const updatedLecture = await prisma.recordedLecture.update({
      where: { id: lectureId },
      data: {
        ...(title && { title }),
        ...(videoUrl && { videoUrl }),
        ...(duration !== undefined && { duration }),
      },
    });

    res.status(200).json({ success: true, updatedLecture });
  } catch (error) {
    console.error('Error updating teacher lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update lecture due to a server error.',
    });
  }
};

export const deleteTeacherLecture = async (req: Request, res: Response) => {
  const { teacherId, lectureId } = req.params;

  if (!teacherId || !lectureId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Teacher ID and Lecture ID are required.' 
    });
  }

  try {
    const lectureToDelete = await prisma.recordedLecture.findFirst({
      where: {
        id: lectureId,
        course: {
          teachers: {
            some: {
              teacherId: teacherId
            }
          }
        }
      }
    });

    if (!lectureToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Lecture not found or you do not have permission to delete it.'
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.lectureProgress.deleteMany({
        where: { recordedLectureId: lectureId }
      });
      
      await tx.recordedLecture.delete({
        where: { id: lectureId }
      });
    });

    res.status(200).json({ success: true, message: 'Lecture deleted successfully.' });
  } catch (error) {
    console.error('Error deleting teacher lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lecture due to a server error.',
    });
  }
};


export const assignTeacherToLecture = async (req: Request, res: Response) => {
  const { lectureId, teacherId } = req.params;

  if (!teacherId || !lectureId) {
    return res.status(400).json({ success: false, message: 'Teacher ID and Lecture ID are required.' });
  }

  try {
    const updatedLecture = await prisma.recordedLecture.update({
      where: { id: lectureId },
      data: { teacherId: teacherId },
      select: {
        id: true,
        title: true,
        teacherId: true,
        courseId: true,
      }
    });

    res.status(200).json({ 
      success: true, 
      message: 'Teacher assigned to lecture successfully.',
      lecture: updatedLecture 
    });

  } catch (error) {
    console.error('Error assigning teacher to lecture:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to assign teacher to lecture due to a server error.' 
    });
  }
};

export const getTeacherDashboard = async (req: Request, res: Response) => {
  const teacherId = req.user?.id;
  if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

  try {
    const teacherCourses = await prisma.courseTeacher.findMany({
      where: { teacherId },
      include: { course: { where: { isDeleted: false }, include: { enrollments: { include: { user: true } } } } },
    });

    const courses = teacherCourses.map((tc: { course: any; }) => tc.course);
    const totalCourses = courses.length;
    const publishedCourses = courses.filter((c: { isPublished: any; }) => c.isPublished).length;
    const draftCourses = courses.filter((c: { isPublished: any; }) => !c.isPublished).length;

    let totalEnrollments = 0;
    let newThisMonth = 0;
    let totalProgress = 0;
    const coursesWithEnrollments = courses.map((course: { enrollments: { map: (arg0: (enroll: { user: { id: any; name: any; }; progress: any; status: any; }) => { id: any; name: any; progress: any; status: any; }) => any; filter: (arg0: (enroll: { enrolledAt: any; }) => any) => { (): any; new(): any; length: number; }; }; id: any; title: any; }) => {
      const students = course.enrollments.map((enroll: { user: { id: any; name: any; }; progress: any; status: any; }) => ({
        id: enroll.user.id,
        name: enroll.user.name,
        progress: enroll.progress,
        status: enroll.status,
      }));
      totalEnrollments += students.length;
      totalProgress += students.reduce((acc: any, s: { progress: any; }) => acc + s.progress, 0);
      newThisMonth += course.enrollments.filter((enroll: { enrolledAt: any; }) => dayjs(enroll.enrolledAt).isSame(dayjs(), "month")).length;
      return { course: { id: course.id, title: course.title }, totalEnrollments: students.length, students };
    });

    const avgProgress = totalEnrollments ? totalProgress / totalEnrollments : 0;

    const quizzes = await prisma.quiz.findMany({ where: { createdById: teacherId }, include: { submissions: true } });
    const totalQuizzes = quizzes.length;
    const totalQuizSubmissions = quizzes.reduce((acc: any, quiz: { submissions: string | any[]; }) => acc + quiz.submissions.length, 0);

    const liveLectures = await prisma.liveLecture.findMany({ where: { teacherId, isActive: true } });
    const recordedLectures = await prisma.recordedLecture.findMany({ where: { teacherId }, include: { participants: true } });
    const now = new Date();
    const upcomingLectures = liveLectures.filter((l: { startTime: number; }) => l.startTime > now).length;
    const pastLectures = liveLectures.filter((l: { startTime: number; }) => l.startTime <= now).length;
    const totalLectures = liveLectures.length + recordedLectures.length;

    const assessments = await prisma.assessment.count({ where: { course: { teachers: { some: { teacherId } } } } });
    const certificates = await prisma.certificate.count({ where: { course: { teachers: { some: { teacherId } } } } });
    const modules = await prisma.module.count({ where: { course: { teachers: { some: { teacherId } } } } });

    const stats = {
      courses: { total: totalCourses, published: publishedCourses, drafts: draftCourses },
      quizzes: { total: totalQuizzes, submissions: totalQuizSubmissions },
      lectures: { total: totalLectures, upcoming: upcomingLectures, past: pastLectures },
      enrollments: { total: totalEnrollments, newThisMonth, avgProgress },
      extra: { assessments, certificates, modules },
    };

    return res.status(200).json({ success: true, stats, coursesWithEnrollments });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

export const getStudentLectureProgress = async (req: Request, res: Response) => {
  try {
    const { teacherId, recordedLectureId } = req.params;

    if (!teacherId || !recordedLectureId) {
      return res.status(400).json({ error: 'Missing teacherId or recordedLectureId in parameters' });
    }

    const progressRecords = await prisma.lectureProgress.findMany({
      where: {
        recordedLectureId,
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
    });

    if (progressRecords.length === 0) {
      return res.status(404).json({ message: 'No student progress found for this lecture' });
    }

    res.json({ progress: progressRecords });
  } catch (error) {
    console.error('Error fetching student lecture progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};