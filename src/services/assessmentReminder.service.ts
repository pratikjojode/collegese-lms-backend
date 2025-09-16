import prisma from '../config/db';
import { NotificationService } from './notification.service';

interface CourseEnrollment {
  userId: string;
}

interface AssessmentSubmission {
  studentId: string;
}

export class AssessmentReminderService {
  static async sendDueReminders() {
    try {
      const upcomingAssessments = await prisma.assessment.findMany({
        where: {
          dueDate: {
            gt: new Date(),
            lt: new Date(Date.now() + 24 * 60 * 60 * 1000) 
          },
          isDeleted: false
        },
        include: {
          course: {
            include: {
              enrollments: {
                select: {
                  userId: true
                }
              }
            }
          },
          submissions: {
            select: {
              studentId: true
            }
          }
        }
      });

      for (const assessment of upcomingAssessments) {
        const enrolledStudentIds = assessment.course.enrollments.map((e: CourseEnrollment) => e.userId);
        const submittedStudentIds = assessment.submissions.map((s: AssessmentSubmission) => s.studentId);
        const pendingStudentIds = enrolledStudentIds.filter((id: string) => !submittedStudentIds.includes(id));

        if (pendingStudentIds.length > 0) {
          await NotificationService.createMultipleNotifications(
            'ASSESSMENT_DUE_REMINDER',
            'Assessment Due Soon',
            `Reminder: "${assessment.title}" is due in less than 24 hours.`,
            pendingStudentIds,
            {
              assessmentId: assessment.id,
              courseId: assessment.courseId,
              dueDate: assessment.dueDate
            }
          );
        }
      }
    } catch (error) {
      console.error('Error sending assessment reminders:', error);
    }
  }
}
