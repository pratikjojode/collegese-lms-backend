import prisma from '../config/db';
import { NotificationType } from '../generated/prisma';

interface CourseEnrollment {
  userId: string;
}

interface CourseTeacher {
  teacherId: string;
}

export class NotificationService {
  static async createNotification(data: {
    type: NotificationType;
    title: string;
    message: string;
    recipientId: string;
    metadata?: any;
  }) {
    return prisma.notification.create({
      data: {
        ...data,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  static async createMultipleNotifications(
    type: NotificationType,
    title: string,
    message: string,
    recipientIds: string[],
    metadata?: any
  ) {
    const notifications = recipientIds.map((recipientId) => ({
      type,
      title,
      message,
      recipientId,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }));

    return prisma.notification.createMany({
      data: notifications,
    });
  }

  static async getUnreadNotifications(userId: string) {
    return prisma.notification.findMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async getAllNotifications(userId: string) {
    return prisma.notification.findMany({
      where: {
        recipientId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  static async markAsRead(notificationId: string) {
    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  static async deleteNotification(notificationId: string) {
    return prisma.notification.delete({
      where: { id: notificationId },
    });
  }
  static async notifyCourseEnrollees(
    courseId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any
  ) {
    const enrollees = await prisma.courseEnrollment.findMany({
      where: { courseId },
      select: { userId: true },
    });

    return this.createMultipleNotifications(
      type,
      title,
      message,
      enrollees.map((e: CourseEnrollment) => e.userId),
      metadata
    );
  }

  static async notifyCourseTeachers(
    courseId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any
  ) {
    const teachers = await prisma.courseTeacher.findMany({
      where: { courseId },
      select: { teacherId: true },
    });

    return this.createMultipleNotifications(
      type,
      title,
      message,
      teachers.map((t: CourseTeacher) => t.teacherId),
      metadata
    );
  }

  static async notifyCourseAssistants(
    courseId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any
  ) {
    const assistants = await prisma.user.findMany({
      where: { 
        role: 'ASSISTANT',
      },
      select: { id: true },
    });

    if (assistants.length > 0) {
      return this.createMultipleNotifications(
        type,
        title,
        message,
        assistants.map((a) => a.id),
        metadata
      );
    }
  }
  static async notifyAdmins(
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any
  ) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      return this.createMultipleNotifications(
        type,
        title,
        message,
        admins.map((a) => a.id),
        metadata
      );
    }
  }
  static async notifySuperAdmins(
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any
  ) {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (superAdmins.length > 0) {
      return this.createMultipleNotifications(
        type,
        title,
        message,
        superAdmins.map((sa) => sa.id),
        metadata
      );
    }
  }
  static async notifyAllCourseStakeholders(
    courseId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any,
    options: {
      notifyStudents?: boolean;
      notifyTeachers?: boolean;
      notifyAssistants?: boolean;
      notifyAdmins?: boolean;
      notifySuperAdmins?: boolean;
    } = {}
  ) {
    const {
      notifyStudents = true,
      notifyTeachers = true,
      notifyAssistants = true,
      notifyAdmins = false, 
      notifySuperAdmins = false,
    } = options;

    const promises = [];

    if (notifyStudents) {
      promises.push(this.notifyCourseEnrollees(courseId, type, title, message, metadata));
    }

    if (notifyTeachers) {
      promises.push(this.notifyCourseTeachers(courseId, type, title, message, metadata));
    }

    if (notifyAssistants) {
      promises.push(this.notifyCourseAssistants(courseId, type, title, message, metadata));
    }

    if (notifyAdmins) {
      promises.push(this.notifyAdmins(type, title, message, metadata));
    }

    if (notifySuperAdmins) {
      promises.push(this.notifySuperAdmins(type, title, message, metadata));
    }
    return Promise.allSettled(promises);
  }

  static async notifyPlatformMaintenance(
    title: string,
    message: string,
    metadata?: {
      maintenanceStart?: string;
      maintenanceEnd?: string;
      affectedServices?: string[];
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
  ) {
    const promises = [
      this.notifyAdmins(NotificationType.PLATFORM_MAINTENANCE, title, message, metadata),
      this.notifySuperAdmins(NotificationType.PLATFORM_MAINTENANCE, title, message, metadata),
    ];

    return Promise.allSettled(promises);
  }

  static async notifySecurityAlert(
    title: string,
    message: string,
    metadata?: {
      alertType?: 'SUSPICIOUS_LOGIN' | 'DATA_BREACH' | 'UNAUTHORIZED_ACCESS' | 'MALWARE_DETECTED';
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      affectedUsers?: string[];
      ipAddress?: string;
      timestamp?: string;
    }
  ) {
    const promises = [
      this.notifyAdmins(NotificationType.SECURITY_ALERT, title, message, metadata),
      this.notifySuperAdmins(NotificationType.SECURITY_ALERT, title, message, metadata),
    ];

    return Promise.allSettled(promises);
  }
  static async notifySystemPerformance(
    title: string,
    message: string,
    metadata?: {
      issueType?: 'HIGH_CPU' | 'LOW_MEMORY' | 'SLOW_DATABASE' | 'HIGH_LATENCY' | 'SERVICE_DOWN';
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      affectedServices?: string[];
      metrics?: {
        cpuUsage?: number;
        memoryUsage?: number;
        responseTime?: number;
      };
    }
  ) {
    const promises = [
      this.notifyAdmins(NotificationType.SYSTEM_PERFORMANCE, title, message, metadata),
      this.notifySuperAdmins(NotificationType.SYSTEM_PERFORMANCE, title, message, metadata),
    ];

    return Promise.allSettled(promises);
  }
  static async notifyUserManagementEvent(
    title: string,
    message: string,
    metadata?: {
      eventType?: 'USER_CREATED' | 'USER_DELETED' | 'ROLE_CHANGED' | 'ACCOUNT_SUSPENDED' | 'MASS_ENROLLMENT';
      affectedUserId?: string;
      affectedUserCount?: number;
      performedBy?: string;
      previousRole?: string;
      newRole?: string;
    }
  ) {
    const promises = [
      this.notifyAdmins(NotificationType.USER_MANAGEMENT, title, message, metadata),
      this.notifySuperAdmins(NotificationType.USER_MANAGEMENT, title, message, metadata),
    ];

    return Promise.allSettled(promises);
  }
  static async notifyBulkOperationCompleted(
    title: string,
    message: string,
    metadata?: {
      operationType?: 'BULK_ENROLLMENT' | 'BULK_GRADE_UPDATE' | 'BULK_EMAIL_SEND' | 'DATA_EXPORT' | 'DATA_IMPORT';
      totalRecords?: number;
      successCount?: number;
      failureCount?: number;
      duration?: string;
      performedBy?: string;
      fileName?: string;
    }
  ) {
    const promises = [
      this.notifyAdmins(NotificationType.BULK_OPERATION_COMPLETED, title, message, metadata),
      this.notifySuperAdmins(NotificationType.BULK_OPERATION_COMPLETED, title, message, metadata),
    ];

    return Promise.allSettled(promises);
  }
  static async notifySystemWide(
    type: NotificationType,
    title: string,
    message: string,
    metadata?: any,
    options: {
      notifyAdmins?: boolean;
      notifySuperAdmins?: boolean;
      notifyTeachers?: boolean;
      notifyAssistants?: boolean;
    } = {}
  ) {
    const {
      notifyAdmins = true,
      notifySuperAdmins = true,
      notifyTeachers = false,
      notifyAssistants = false,
    } = options;

    const promises = [];

    if (notifyAdmins) {
      promises.push(this.notifyAdmins(type, title, message, metadata));
    }

    if (notifySuperAdmins) {
      promises.push(this.notifySuperAdmins(type, title, message, metadata));
    }

    if (notifyTeachers) {
      const teachers = await prisma.user.findMany({
        where: { role: 'TEACHER' },
        select: { id: true },
      });

      if (teachers.length > 0) {
        promises.push(
          this.createMultipleNotifications(
            type,
            title,
            message,
            teachers.map((t) => t.id),
            metadata
          )
        );
      }
    }
    if (notifyAssistants) {
      const assistants = await prisma.user.findMany({
        where: { role: 'ASSISTANT' },
        select: { id: true },
      });

      if (assistants.length > 0) {
        promises.push(
          this.createMultipleNotifications(
            type,
            title,
            message,
            assistants.map((a) => a.id),
            metadata
          )
        );
      }
    }
    return Promise.allSettled(promises);
  }
  static async notifyTeacherCourseAssignment(
    teacherId: string,
    courseId: string,
    courseName: string,
    assignedBy: string, 
    metadata?: {
      courseId?: string;
      assignedById?: string;
      assignedByRole?: string;
      assignmentDate?: string;
      courseDescription?: string;
    }
  ) {
    return this.createNotification({
      type: NotificationType.TEACHER_ASSIGNED_TO_COURSE,
      title: 'Course Assignment',
      message: `You have been assigned to teach the course "${courseName}" by ${assignedBy}.`,
      recipientId: teacherId,
      metadata: {
        courseId,
        assignedBy,
        assignmentDate: new Date().toISOString(),
        ...metadata
      }
    });
  }
  static async notifyAssistantGradingAssignment(
    assistantId: string,
    assessmentId: string,
    assessmentTitle: string,
    courseId: string,
    courseName: string,
    assignedBy: string, 
    metadata?: {
      assessmentId?: string;
      courseId?: string;
      assignedById?: string;
      assignedByRole?: string;
      assignmentDate?: string;
      dueDate?: string;
      gradingInstructions?: string;
    }
  ) {
    return this.createNotification({
      type: NotificationType.ASSISTANT_ASSIGNED_TO_GRADING,
      title: 'Grading Assignment',
      message: `You have been assigned to help grade "${assessmentTitle}" in ${courseName} by ${assignedBy}.`,
      recipientId: assistantId,
      metadata: {
        assessmentId,
        courseId,
        assignedBy,
        assessmentTitle,
        courseName,
        assignmentDate: new Date().toISOString(),
        ...metadata
      }
    });
  }
  static async notifyAssistantCourseAssignment(
    assistantId: string,
    courseId: string,
    courseName: string,
    assignedBy: string, 
    role: 'TEACHING_ASSISTANT' | 'GRADING_ASSISTANT' | 'LAB_ASSISTANT' = 'TEACHING_ASSISTANT',
    metadata?: {
      courseId?: string;
      assignedById?: string;
      assignedByRole?: string;
      assignmentDate?: string;
      role?: string;
      responsibilities?: string[];
    }
  ) {
    return this.createNotification({
      type: NotificationType.ASSISTANT_ASSIGNED_TO_COURSE,
      title: 'Course Assistant Assignment',
      message: `You have been assigned as a ${role.replace('_', ' ').toLowerCase()} for "${courseName}" by ${assignedBy}.`,
      recipientId: assistantId,
      metadata: {
        courseId,
        assignedBy,
        role,
        courseName,
        assignmentDate: new Date().toISOString(),
        ...metadata
      }
    });
  }
  static async notifyMultipleAssistantsGradingAssignment(
    assistantIds: string[],
    assessmentId: string,
    assessmentTitle: string,
    courseId: string,
    courseName: string,
    assignedBy: string,
    metadata?: any
  ) {
    const notifications = assistantIds.map((assistantId) => ({
      type: NotificationType.ASSISTANT_ASSIGNED_TO_GRADING,
      title: 'Grading Assignment',
      message: `You have been assigned to help grade "${assessmentTitle}" in ${courseName} by ${assignedBy}.`,
      recipientId: assistantId,
      metadata: JSON.stringify({
        assessmentId,
        courseId,
        assignedBy,
        assessmentTitle,
        courseName,
        assignmentDate: new Date().toISOString(),
        ...metadata
      })
    }));

    return prisma.notification.createMany({
      data: notifications
    });
  }

  static async notifyRoleUpdate(
    userId: string,
    oldRole: string,
    newRole: string,
    updatedBy: string,
    metadata?: {
      oldRole?: string;
      newRole?: string;
      updatedById?: string;
      updateDate?: string;
      additionalPermissions?: string[];
    }
  ) {
    const notificationType = newRole === 'TEACHER' 
      ? NotificationType.TEACHER_ROLE_UPDATED 
      : NotificationType.ASSISTANT_ROLE_UPDATED;

    return this.createNotification({
      type: notificationType,
      title: 'Role Updated',
      message: `Your role has been updated from ${oldRole} to ${newRole} by ${updatedBy}.`,
      recipientId: userId,
      metadata: {
        oldRole,
        newRole,
        updatedBy,
        updateDate: new Date().toISOString(),
        ...metadata
      }
    });
  }

  static async handleTeacherAssignment(
    teacherId: string,
    courseId: string,
    courseName: string,
    assignedById: string,
    assignedByName: string,
    assignedByRole: 'ADMIN' | 'SUPER_ADMIN',
    metadata?: any
  ) {
    await this.notifyTeacherCourseAssignment(
      teacherId,
      courseId,
      courseName,
      assignedByName,
      {
        assignedById,
        assignedByRole,
        ...metadata
      }
    );
  }

  static async handleAssistantAssignment(
    assistantId: string,
    assignmentType: 'COURSE' | 'GRADING',
    courseId: string,
    courseName: string,
    assignedById: string,
    assignedByName: string,
    assignedByRole: 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN',
    additionalData?: {
      assessmentId?: string;
      assessmentTitle?: string;
      role?: string;
      dueDate?: string;
    }
  ) {
    if (assignmentType === 'GRADING' && additionalData?.assessmentId) {
      await this.notifyAssistantGradingAssignment(
        assistantId,
        additionalData.assessmentId,
        additionalData.assessmentTitle || 'Assessment',
        courseId,
        courseName,
        assignedByName,
        {
          assignedById,
          assignedByRole,
          dueDate: additionalData.dueDate,
        }
      );
    } else {
      await this.notifyAssistantCourseAssignment(
        assistantId,
        courseId,
        courseName,
        assignedByName,
        'TEACHING_ASSISTANT',
        {
          assignedById,
          assignedByRole,
          role: additionalData?.role,
        }
      );
    }
  }
}
