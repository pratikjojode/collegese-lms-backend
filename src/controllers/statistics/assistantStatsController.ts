import { Request, Response } from "express";
import { PrismaClient } from "generated/prisma";

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "STUDENT" | "ADMIN" | "TEACHER" | "ASSISTANT" | "SUPER_ADMIN";
    forcePasswordChange: boolean;
  };
}

export const getAssistantDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const assistantId = req.user.id;
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));

    const [
      // Existing queries
      assignedAssessments,
      pendingGrading,
      studentsSupported,
      upcomingLectures,
      notifications,
      
      // New comprehensive stats
      completedGradingStats,
      overduePendingGrading,
      gradingWorkloadByAssessment,
      recentGradingActivity,
      coursesSupported,
      averageGradingTime,
      gradingDistribution,
      studentSubmissionStats,
      weeklyGradingProgress,
      unreadNotifications,
      urgentTasks
    ] = await Promise.all([
      // Existing queries
      prisma.assessmentAssistant.findMany({
        where: { assistantId },
        include: {
          assessment: { 
            include: { 
              course: true,
              submissions: {
                select: {
                  id: true,
                  status: true,
                  submittedAt: true,
                  gradedAt: true
                }
              }
            } 
          },
        },
      }),

      prisma.assessmentSubmission.count({
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "SUBMITTED",
          grade: null,
        },
      }),

      prisma.courseEnrollment.findMany({
        where: {
          course: { assessments: { some: { assignedAssistants: { some: { assistantId } } } } },
        },
        include: { user: true, course: true },
      }),

      prisma.liveLecture.findMany({
        where: {
          course: { assessments: { some: { assignedAssistants: { some: { assistantId } } } } },
          startTime: { gte: new Date() },
        },
        orderBy: { startTime: "asc" },
        take: 5,
        include: { course: true, teacher: true },
      }),

      prisma.notification.findMany({
        where: { recipientId: assistantId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // New comprehensive queries
      
      // Completed grading statistics
      prisma.assessmentSubmission.findMany({
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "GRADED",
          gradedById: assistantId,
        },
        select: {
          id: true,
          grade: true,
          gradedAt: true,
          submittedAt: true,
          assessment: {
            select: {
              title: true,
              totalMarks: true,
              course: { select: { title: true } }
            }
          },
          student: {
            select: { name: true, email: true }
          }
        },
        orderBy: { gradedAt: "desc" },
        take: 20
      }),

      // Overdue pending submissions (past due date)
      prisma.assessmentSubmission.count({
        where: {
          assessment: { 
            assignedAssistants: { some: { assistantId } },
            dueDate: { lt: new Date() }
          },
          status: "SUBMITTED",
          grade: null,
        },
      }),

      // Grading workload per assessment
      prisma.assessment.findMany({
        where: { assignedAssistants: { some: { assistantId } } },
        include: {
          course: { select: { title: true } },
          submissions: {
            where: { status: "SUBMITTED", grade: null },
            select: { id: true, submittedAt: true }
          },
          _count: {
            select: {
              submissions: {
                where: { status: "SUBMITTED", grade: null }
              }
            }
          }
        },
        orderBy: { dueDate: "asc" }
      }),

      // Recent grading activity (last 7 days)
      prisma.assessmentSubmission.count({
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "GRADED",
          gradedById: assistantId,
          gradedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
      }),

      // Unique courses the assistant is supporting
      prisma.course.findMany({
        where: {
          assessments: { some: { assignedAssistants: { some: { assistantId } } } }
        },
        include: {
          _count: {
            select: {
              assessments: {
                where: { assignedAssistants: { some: { assistantId } } }
              },
              enrollments: true
            }
          },
          teachers: {
            include: {
              teacher: { select: { name: true, email: true } }
            }
          }
        }
      }),

      // Average grading time calculation
      prisma.assessmentSubmission.findMany({
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "GRADED",
          gradedById: assistantId,
          submittedAt: { not: null },
          gradedAt: { not: null }
        },
        select: {
          submittedAt: true,
          gradedAt: true
        }
      }),

      // Grade distribution for assistant's graded submissions
      prisma.assessmentSubmission.groupBy({
        by: ['grade'],
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "GRADED",
          gradedById: assistantId,
          grade: { not: null }
        },
        _count: { grade: true }
      }),

      // Student submission statistics
      prisma.assessmentSubmission.groupBy({
        by: ['status'],
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } }
        },
        _count: { status: true }
      }),

      // Weekly grading progress
      prisma.assessmentSubmission.count({
        where: {
          assessment: { assignedAssistants: { some: { assistantId } } },
          status: "GRADED",
          gradedById: assistantId,
          gradedAt: {
            gte: startOfWeek,
            lte: endOfWeek
          }
        },
      }),

      // Unread notifications count
      prisma.notification.count({
        where: {
          recipientId: assistantId,
          isRead: false
        }
      }),

      // Urgent tasks (due within 24 hours)
      prisma.assessmentSubmission.count({
        where: {
          assessment: { 
            assignedAssistants: { some: { assistantId } },
            dueDate: {
              gte: new Date(),
              lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          },
          status: "SUBMITTED",
          grade: null,
        },
      })
    ]);

    // Calculate average grading time in hours
    const avgGradingTimeHours = averageGradingTime.length > 0 
      ? averageGradingTime.reduce((sum, submission) => {
          if (submission.submittedAt && submission.gradedAt) {
            const timeDiff = submission.gradedAt.getTime() - submission.submittedAt.getTime();
            return sum + (timeDiff / (1000 * 60 * 60)); // Convert to hours
          }
          return sum;
        }, 0) / averageGradingTime.length
      : 0;

    // Transform grade distribution for better frontend consumption
    const processedGradeDistribution = gradingDistribution.map(item => ({
      gradeRange: item.grade ? `${Math.floor(item.grade!)}-${Math.floor(item.grade!) + 10}` : 'Ungraded',
      count: item._count.grade
    }));

    res.json({
      overview: {
        // Existing stats
        totalAssignedAssessments: assignedAssessments.length,
        pendingGrading,
        totalStudentsSupported: studentsSupported.length,
        upcomingLectures: upcomingLectures.length,
        
        // New comprehensive stats
        completedGrading: completedGradingStats.length,
        overduePendingGrading,
        recentGradingActivity,
        coursesSupported: coursesSupported.length,
        averageGradingTimeHours: Math.round(avgGradingTimeHours * 100) / 100,
        weeklyGradingProgress,
        unreadNotifications,
        urgentTasks
      },

      // Existing data
      assignedAssessments,
      studentsSupported,
      upcomingLectures,
      notifications,

      // New detailed data
      workloadBreakdown: {
        assessments: gradingWorkloadByAssessment.map(assessment => ({
          id: assessment.id,
          title: assessment.title,
          course: assessment.course.title,
          pendingSubmissions: assessment._count.submissions,
          dueDate: assessment.dueDate,
          oldestSubmission: assessment.submissions.length > 0 
            ? Math.min(...assessment.submissions.map(s => s.submittedAt?.getTime() || Date.now()))
            : null
        }))
      },

      coursesSupported: coursesSupported.map(course => ({
        id: course.id,
        title: course.title,
        assessmentCount: course._count.assessments,
        studentCount: course._count.enrollments,
        teachers: course.teachers.map(ct => ct.teacher)
      })),

      gradingStats: {
        distribution: processedGradeDistribution,
        recentActivity: completedGradingStats.slice(0, 10).map(submission => ({
          id: submission.id,
          assessmentTitle: submission.assessment.title,
          courseTitle: submission.assessment.course.title,
          studentName: submission.student.name,
          grade: submission.grade,
          totalMarks: submission.assessment.totalMarks,
          gradedAt: submission.gradedAt,
          turnaroundTime: submission.submittedAt && submission.gradedAt 
            ? Math.round((submission.gradedAt.getTime() - submission.submittedAt.getTime()) / (1000 * 60 * 60 * 24) * 100) / 100
            : null
        }))
      },

      submissionStats: studentSubmissionStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>),

      quickActions: {
        urgentGrading: urgentTasks,
        overdueItems: overduePendingGrading,
        todaysTarget: Math.ceil(pendingGrading / 7), 
        weeklyProgress: `${weeklyGradingProgress} graded this week`
      }
    });

  } catch (error) {
    console.error("Error fetching assistant dashboard:", error);
    res.status(500).json({ error: "Failed to fetch assistant dashboard" });
  }
};