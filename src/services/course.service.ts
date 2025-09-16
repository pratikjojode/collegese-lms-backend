import { PrismaClient } from "generated/prisma";

const prisma = new PrismaClient();

export class CourseService {
  static async updateCourseProgress(
    studentId: string,
    courseId: string,
    progress: number
  ): Promise<{ success: boolean; message: string; wasCompleted?: boolean }> {
    try {
      const validProgress = Math.max(0, Math.min(100, progress));
      const updatedEnrollment = await prisma.courseEnrollment.updateMany({
        where: {
          userId: studentId,
          courseId: courseId,
        },
        data: {
          progress: validProgress,
          status: validProgress >= 100 ? "COMPLETED" : "IN_PROGRESS",
          updatedAt: new Date(),
        },
      });
      if (updatedEnrollment.count === 0) {
        return {
          success: false,
          message: "Enrollment not found",
        };
      }
      const wasCompleted = validProgress >= 100;
      return {
        success: true,
        message: `Course progress updated to ${validProgress}%`,
        wasCompleted,
      };
    } catch (error) {
      console.error("Error updating course progress:", error);
      return {
        success: false,
        message: "Failed to update course progress",
      };
    }
  }

  static async syncCourseCompletionStatus(studentId: string): Promise<{ updated: number }> {
    try {
      const enrollmentsToUpdate = await prisma.courseEnrollment.findMany({
        where: {
          userId: studentId,
          progress: { gte: 100 },
          status: { not: "COMPLETED" },
        },
      });

      if (enrollmentsToUpdate.length === 0) {
        return { updated: 0 };
      }

      await prisma.courseEnrollment.updateMany({
        where: {
          userId: studentId,
          progress: { gte: 100 },
          status: { not: "COMPLETED" },
        },
        data: {
          status: "COMPLETED",
          updatedAt: new Date(),
        },
      });

      return { updated: enrollmentsToUpdate.length };
    } catch (error) {
      console.error("Error syncing course completion status:", error);
      return { updated: 0 };
    }
  }

  static async getCourseCompletionStats(studentId: string) {
    try {
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

      const stats = {
        totalEnrolled: validEnrollments.length,
        completed: validEnrollments.filter(e => e.progress >= 100 || e.status === "COMPLETED").length,
        inProgress: validEnrollments.filter(e => e.progress > 0 && e.progress < 100 && e.status !== "COMPLETED").length,
        notStarted: validEnrollments.filter(e => e.progress === 0).length,
        averageProgress: validEnrollments.length > 0
          ? validEnrollments.reduce((sum, e) => sum + e.progress, 0) / validEnrollments.length
          : 0,
      };

      return { success: true, stats };
    } catch (error) {
      console.error("Error getting course completion stats:", error);
      return { success: false, stats: null };
    }
  }

  static async validateCourseCompletion(studentId: string, courseId: string): Promise<boolean> {
    try {
      const enrollment = await prisma.courseEnrollment.findFirst({
        where: {
          userId: studentId,
          courseId: courseId,
        },
        include: {
          course: {
            select: {
              isActive: true,
              isDeleted: true,
            },
          },
        },
      });

      if (!enrollment || !enrollment.course) {
        return false;
      }

      if (enrollment.course.isDeleted || !enrollment.course.isActive) {
        return false;
      }

      return enrollment.progress >= 100 || enrollment.status === "COMPLETED";
    } catch (error) {
      console.error("Error validating course completion:", error);
      return false;
    }
  }
}
