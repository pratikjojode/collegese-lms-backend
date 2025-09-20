import { Request, Response } from "express";
import { Prisma, PrismaClient } from "generated/prisma";
import { CourseService } from "../../services/course.service";

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); 
    const totalUsers = await prisma.user.count();
    const totalStudents = await prisma.user.count({ where: { role: "STUDENT" } });
    const totalTeachers = await prisma.user.count({ where: { role: "TEACHER" } });
    const totalAssistants = await prisma.user.count({ where: { role: "ASSISTANT" } });
    const newUsersThisMonth = await prisma.user.count({ where: { createdAt: { gte: startOfMonth } } });
    const newUsersThisWeek = await prisma.user.count({ where: { createdAt: { gte: startOfWeek } } });
    const totalCourses = await prisma.course.count();
    const publishedCourses = await prisma.course.count({ where: { isPublished: true } });
    const draftCourses = await prisma.course.count({ where: { isPublished: false } });
    const activeCourses = await prisma.course.count({ where: { isActive: true } });
    const totalQuizzes = await prisma.quiz.count();
    const totalQuizSubmissions = await prisma.quizSubmission?.count?.() ?? 0;
    const totalAssessments = await prisma.assessment.count();
    const totalAssessmentSubmissions = await prisma.assessmentSubmission.count();
    const totalLiveLectures = await prisma.liveLecture.count();
    const upcomingLectures = await prisma.liveLecture.count({ where: { startTime: { gte: now } } });
    const pastLectures = await prisma.liveLecture.count({ where: { startTime: { lt: now } } });
    const totalEnrollments = await prisma.courseEnrollment.count();

    const newEnrollmentsThisMonth = await prisma.courseEnrollment.count({
      where: { enrolledAt: { gte: startOfMonth } },
    });

    const enrollmentByStatus = await prisma.courseEnrollment.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const avgProgress = await prisma.courseEnrollment.aggregate({
      _avg: { progress: true },
    });
  
    const mostEnrolledCourses = await prisma.courseEnrollment.groupBy({
      by: ["courseId"],
      _count: { courseId: true },
      orderBy: { _count: { courseId: "desc" } },
      take: 5,
    });

    const courseIds = mostEnrolledCourses.map(c => c.courseId).filter(id => id !== null);

    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    });

    const mostEnrolledCoursesWithNames = mostEnrolledCourses.map(item => ({
      ...item,
      course: courses.find(c => c.id === item.courseId) || null,
    }));
    res.status(200).json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          students: totalStudents,
          teachers: totalTeachers,
          assistants: totalAssistants,
          newThisMonth: newUsersThisMonth,
          newThisWeek: newUsersThisWeek,
        },
        courses: {
          total: totalCourses,
          published: publishedCourses,
          drafts: draftCourses,
          active: activeCourses,
        },
        quizzes: {
          total: totalQuizzes,
          submissions: totalQuizSubmissions,
        },
        assessments: {
          total: totalAssessments,
          submissions: totalAssessmentSubmissions,
        },
        lectures: {
          total: totalLiveLectures,
          upcoming: upcomingLectures,
          past: pastLectures,
        },
        enrollments: {
          total: totalEnrollments,
          newThisMonth: newEnrollmentsThisMonth,
          byStatus: enrollmentByStatus,
          avgProgress: avgProgress._avg.progress ?? 0,
          topCourses: mostEnrolledCoursesWithNames,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard stats due to a server error.",
    });
  }
};

export const getTeacherCourseEnrollments = async (req: Request, res: Response) => {
  const teacherId = req.user?.id;
  if (!teacherId) {
    return res.status(401).json({ message: "Unauthorized: teacher not found" });
  }

  try {
    const courses = await prisma.course.findMany({
      where: {
        teachers: {
          some: { teacherId },
        },
        isDeleted: false,
        isActive: true,
      } as any, 
      include: {
        enrollments: {
          where: { user: { role: "STUDENT" } },
          include: { user: true },
        },
      } as unknown as Prisma.CourseInclude,
      orderBy: { createdAt: "desc" },
    }) as unknown as Array<{
      id: string;
      title: string;
      enrollments: Array<{
        user: { id: string; name: string };
        progress: number;
        status: string;
      }>;
    }>;

    const result = courses.map((course) => ({
      course: { id: course.id, title: course.title },
      totalEnrollments: course.enrollments.length,
      students: course.enrollments.map((enroll) => ({
        id: enroll.user.id,
        name: enroll.user.name,
        progress: enroll.progress,
        status: enroll.status,
      })),
    }));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching teacher courses:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

export const getStudentOverview = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    await CourseService.syncCourseCompletionStatus(studentId);
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: studentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            isActive: true,
            isDeleted: true,
          },
        },
      },
    });

    const validEnrollments = enrollments.filter(
      (enrollment) => enrollment.course && !enrollment.course.isDeleted && enrollment.course.isActive
    );

    const totalEnrolledCourses = validEnrollments.length;
    const completedCourses = validEnrollments.filter(
      (enrollment) => enrollment.status === "COMPLETED" || enrollment.progress >= 100
    ).length;
    const avgProgress = validEnrollments.length > 0
      ? validEnrollments.reduce((sum, e) => sum + e.progress, 0) / validEnrollments.length
      : 0;
    const totalQuizAttempts = await prisma.quizSubmission.count({
      where: { userId: studentId },
    });

    const quizSubmissions = await prisma.quizSubmission.findMany({
      where: { userId: studentId },
      select: { score: true },
    });
    const avgQuizScore = quizSubmissions.length > 0
      ? quizSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / quizSubmissions.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalEnrolledCourses,
        completedCourses,
        avgProgress: Math.round(avgProgress),
        totalQuizAttempts,
        avgQuizScore: Math.round(avgQuizScore),
      },
    });
  } catch (error) {
    console.error("Error fetching student overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve student overview",
    });
  }
};

export const getStudentQuizTrend = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const quizSubmissions = await prisma.quizSubmission.findMany({
      where: {
        userId: studentId,
        submittedAt: { gte: thirtyDaysAgo },
      },
      include: {
        quiz: {
          select: { title: true },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    const quizTrendData = quizSubmissions.map((submission) => ({
      date: submission.submittedAt?.toISOString().split('T')[0] || "",
      score: submission.score || 0,
      quizName: submission.quiz?.title || "Unknown Quiz",
    }));

    res.status(200).json({
      success: true,
      data: quizTrendData,
    });
  } catch (error) {
    console.error("Error fetching student quiz trend:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve quiz trend",
    });
  }
};

export const getStudentAssessmentStatus = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    const assessmentSubmissions = await prisma.assessmentSubmission.findMany({
      where: { studentId },
      select: { status: true },
    });

    const statusCounts = {
      completed: 0,
      pending: 0,
      failed: 0,
    };

    assessmentSubmissions.forEach((submission) => {
      if (submission.status === "GRADED") {
        statusCounts.completed++;
      } else if (submission.status === "NOT_SUBMITTED") {
        statusCounts.pending++;
      } else if (submission.status === "SUBMITTED") {
        statusCounts.pending++;
      }
    });
    res.status(200).json({
      success: true,
      data: statusCounts,
    });
  } catch (error) {
    console.error("Error fetching student assessment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve assessment status",
    });
  }
};

export const getStudentLiveLecturesAnalytics = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    const now = new Date();

    const participatedLectures = await prisma.lectureParticipant.findMany({
      where: { userId: studentId },
      include: {
        lecture: {
          include: {
            course: {
              select: { title: true },
            },
          },
        },
      },
    });

    const totalParticipated = participatedLectures.length;

    const enrolledCourses = await prisma.courseEnrollment.findMany({
      where: { userId: studentId },
      select: { courseId: true },
    });

    const enrolledCourseIds = enrolledCourses.map(e => e.courseId).filter(id => id !== null);

    const upcomingLectures = await prisma.liveLecture.count({
      where: {
        courseId: { in: enrolledCourseIds },
        startTime: { gt: now },
      },
    });

    const ongoingLectures = await prisma.liveLecture.count({
      where: {
        courseId: { in: enrolledCourseIds },
        startTime: { lte: now },
        endTime: { gte: now },
      },
    });

    const completedLectures = await prisma.liveLecture.count({
      where: {
        courseId: { in: enrolledCourseIds },
        endTime: { lt: now },
      },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentParticipation = await prisma.lectureParticipant.count({
      where: {
        userId: studentId,
        joinedAt: { gte: thirtyDaysAgo },
      },
    });

    const participationByCourse = await prisma.lectureParticipant.groupBy({
      by: ["lectureId"],
      where: { userId: studentId },
      _count: { lectureId: true },
    });

    const lectureIds = participatedLectures.map(p => p.lectureId);
    const uniqueLectureIds = [...new Set(lectureIds)];

    const lecturesWithDetails = await prisma.liveLecture.findMany({
      where: { id: { in: uniqueLectureIds } },
      include: {
        course: {
          select: { title: true },
        },
      },
    });

    const courseParticipation = lecturesWithDetails.reduce((acc: { [key: string]: number }, lecture) => {
      const courseName = lecture.course?.title || "Unknown Course";
      acc[courseName] = (acc[courseName] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        totalParticipated,
        upcomingLectures,
        ongoingLectures,
        completedLectures,
        recentParticipation,
        courseParticipation: Object.entries(courseParticipation).map(([course, count]) => ({
          course,
          count,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching student live lectures analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve live lectures analytics",
    });
  }
};

export const getStudentEnrolledCourses = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { userId: studentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            isActive: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const validEnrollments = enrollments.filter(
      (enrollment) => enrollment.course && !enrollment.course.isDeleted && enrollment.course.isActive
    );

    const enrollmentsToUpdate = validEnrollments.filter(
      (enrollment) => enrollment.progress >= 100 && enrollment.status !== "COMPLETED"
    );

    if (enrollmentsToUpdate.length > 0) {
      await Promise.all(
        enrollmentsToUpdate.map((enrollment) =>
          prisma.courseEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          })
        )
      );
    }

    const updatedEnrollments = await prisma.courseEnrollment.findMany({
      where: { userId: studentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            isActive: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    const validUpdatedEnrollments = updatedEnrollments.filter(
      (enrollment) => enrollment.course && !enrollment.course.isDeleted && enrollment.course.isActive
    );

    const courseData = validUpdatedEnrollments.map((enrollment) => ({
      courseId: enrollment.course?.id || '',
      courseName: enrollment.course?.title || 'Unknown Course',
      progress: enrollment.progress,
      status: enrollment.progress >= 100 ? "COMPLETED" : enrollment.status,
      enrolledAt: enrollment.enrolledAt,
    }));

    const statusCounts = courseData.reduce((acc, enrollment) => {
      const effectiveStatus = enrollment.progress >= 100 ? "COMPLETED" : enrollment.status;
      acc[effectiveStatus] = (acc[effectiveStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    res.status(200).json({
      success: true,
      data: {
        courses: courseData,
        statusBreakdown: statusData,
        totalCourses: courseData.length,
      },
    });
  } catch (error) {
    console.error("Error fetching student enrolled courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve enrolled courses data",
    });
  }
};

export const syncStudentCourseCompletion = async (req: Request, res: Response) => {
  const studentId = req.user?.id;
  if (!studentId) {
    return res.status(401).json({ success: false, message: "Unauthorized: student not found" });
  }

  try {
    const result = await CourseService.syncCourseCompletionStatus(studentId);

    res.status(200).json({
      success: true,
      message: `Synced course completion status. Updated ${result.updated} enrollments.`,
      data: { enrollmentsUpdated: result.updated },
    });
  } catch (error) {
    console.error("Error syncing course completion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync course completion status",
    });
  }
};

export const getAdminCourseProgress = async (req: Request, res: Response) => {
  try {
    const { courseId, userId } = req.params;

    if (!courseId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Course ID and User ID are required"
      });
    }
    const enrollment = await prisma.courseEnrollment.findFirst({
      where: {
        courseId: courseId,
        userId: userId
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found"
      });
    }
    const recordedLectures = await prisma.recordedLecture.findMany({
      where: { courseId: courseId },
      include: {
        participants: {
          where: { userId: userId },
          select: {
            progress: true,
            completed: true,
            watchedAt: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });
    const quizSubmissions = await prisma.quizSubmission.findMany({
      where: {
        userId: userId,
        quiz: {
          courseId: courseId
        }
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            questions: {
              select: {
                id: true
              },
              where: {
                isLatest: true
              }
            }
          }
        }
      }
    });
    const assessmentSubmissions = await prisma.assessmentSubmission.findMany({
      where: {
        studentId: userId,
        assessment: {
          courseId: courseId
        }
      },
      include: {
        assessment: {
          select: {
            id: true,
            title: true,
            totalMarks: true
          }
        }
      }
    });
    const totalLectures = recordedLectures.length;
    const completedLectures = recordedLectures.filter(lecture =>
      lecture.participants.length > 0 && lecture.participants[0].completed
    ).length;
    const totalQuizzes = await prisma.quiz.count({ where: { courseId: courseId } });
    const completedQuizzes = quizSubmissions.length;
    const totalAssessments = await prisma.assessment.count({ where: { courseId: courseId } });
    const completedAssessments = assessmentSubmissions.length;
    const lectureProgress = totalLectures > 0 ? (completedLectures / totalLectures) * 100 : 0;
    const quizProgress = totalQuizzes > 0 ? (completedQuizzes / totalQuizzes) * 100 : 0;
    const assessmentProgress = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;
    const overallProgress = Math.round(
      (lectureProgress * 0.4) + (quizProgress * 0.3) + (assessmentProgress * 0.3)
    );
    let status = enrollment.status;
    if (overallProgress >= 100 && status !== 'COMPLETED') {
      status = 'COMPLETED';
      await prisma.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { status: 'COMPLETED', progress: 100 }
      });
    }
    res.status(200).json({
      success: true,
      data: {
        enrollment: {
          id: enrollment.id,
          status: status,
          progress: overallProgress,
          enrolledAt: enrollment.enrolledAt
        },
        course: enrollment.course,
        user: enrollment.user,
        progress: {
          overall: overallProgress,
          lectures: {
            completed: completedLectures,
            total: totalLectures,
            percentage: Math.round(lectureProgress)
          },
          quizzes: {
            completed: completedQuizzes,
            total: totalQuizzes,
            percentage: Math.round(quizProgress)
          },
          assessments: {
            completed: completedAssessments,
            total: totalAssessments,
            percentage: Math.round(assessmentProgress)
          }
        },
        lectures: recordedLectures.map(lecture => ({
          id: lecture.id,
          title: lecture.title,
          order: lecture.order,
          duration: lecture.duration,
          progress: lecture.participants[0]?.progress || 0,
          completed: lecture.participants[0]?.completed || false,
          lastWatchedAt: lecture.participants[0]?.watchedAt
        })),
        quizSubmissions: quizSubmissions.map(submission => ({
          quizId: submission.quiz.id,
          quizTitle: submission.quiz.title,
          score: submission.score,
          totalQuestions: submission.quiz.questions.length,
          submittedAt: submission.submittedAt
        })),
        assessmentSubmissions: assessmentSubmissions.map(submission => ({
          assessmentId: submission.assessment.id,
          assessmentTitle: submission.assessment.title,
          marksObtained: submission.grade,
          totalMarks: submission.assessment.totalMarks,
          submittedAt: submission.submittedAt
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching admin course progress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve course progress data"
    });
  }
};

export const getAdminCourseStats = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  try {
    const [totalEnrollments, completedEnrollments, activeEnrollments, avgProgress, totalLectures, totalQuizzes, totalAssessments] = await Promise.all([
      prisma.courseEnrollment.count({ where: { courseId } }),
      prisma.courseEnrollment.count({ where: { courseId, status: 'COMPLETED' } }),
      prisma.courseEnrollment.count({ where: { courseId, status: 'IN_PROGRESS' } }),
      prisma.courseEnrollment.aggregate({ where: { courseId }, _avg: { progress: true } }),
      prisma.recordedLecture.count({ where: { courseId } }),
      prisma.quiz.count({ where: { courseId } }),
      prisma.assessment.count({ where: { courseId } })
    ]);
    res.status(200).json({
      success: true,
      data: {
        totalEnrollments,
        completedEnrollments,
        activeEnrollments,
        averageProgress: avgProgress._avg.progress ?? 0,
        totalLectures,
        totalQuizzes,
        totalAssessments
      }
    });
  } catch (error) {
    console.error('Error fetching admin course stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch course stats' });
  }
};

export const getAdminCourseEnrollments = async (req: Request, res: Response) => {
  const { courseId } = req.params;
  try {
    const enrollments = await prisma.courseEnrollment.findMany({
      where: { courseId },
      include: {
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { enrolledAt: 'desc' }
    });
    const result = enrollments.map(e => ({
      id: e.id,
      status: e.status,
      progress: e.progress,
      enrolledAt: e.enrolledAt,
      user: e.user
    }));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching admin course enrollments:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch enrollments' });
  }
};
