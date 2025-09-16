import { Parser } from 'json2csv';
import * as XLSX from 'xlsx';
import prisma from '../config/db';
import { Role, GradeStatus, QuizStatus } from '../generated/prisma';

export class ExportService {

  private static formatDate(date: Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0]; 
  }

  private static formatDateTime(date: Date | null | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleString();
  }

  private static parseJSON(jsonString: any): string {
    if (!jsonString) return '';
    try {
      return typeof jsonString === 'string' ? jsonString : JSON.stringify(jsonString);
    } catch {
      return String(jsonString);
    }
  }

  static async exportUsers(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        collegese_lms_id: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        year: true,
        courseName: true,
        Gender: true,
        dateOfBirth: true,
        address: true,
        guardianPhone: true,
        attendancePercentage: true,
        grade: true,
        completedCourse: true,
        isVerified: true,
        isSuspended: true,
        isDeleted: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: true,
            teachingCourses: true,
            createdCourses: true,
            certificates: true,
            assessmentSubmissions: true,
            quizSubmissions: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = users.map(user => ({
      'User ID': user.id,
      'Name': user.name,
      'LMS ID': user.collegese_lms_id || '',
      'Email': user.email,
      'Phone': user.phone || '',
      'Role': user.role,
      'Department': user.department || '',
      'Year': user.year || '',
      'Course Name': user.courseName || '',
      'Gender': user.Gender || '',
      'Date of Birth': this.formatDate(user.dateOfBirth),
      'Address': user.address || '',
      'Guardian Phone': user.guardianPhone || '',
      'Attendance %': user.attendancePercentage || 0,
      'Grade': user.grade || '',
      'Course Completed': user.completedCourse ? 'Yes' : 'No',
      'Verified': user.isVerified ? 'Yes' : 'No',
      'Suspended': user.isSuspended ? 'Yes' : 'No',
      'Deleted': user.isDeleted ? 'Yes' : 'No',
      'Last Login': this.formatDateTime(user.lastLogin),
      'Enrollments Count': user._count.enrollments,
      'Teaching Courses': user._count.teachingCourses,
      'Created Courses': user._count.createdCourses,
      'Certificates': user._count.certificates,
      'Assessment Submissions': user._count.assessmentSubmissions,
      'Quiz Submissions': user._count.quizSubmissions,
      'Registered On': this.formatDateTime(user.createdAt),
      'Last Updated': this.formatDateTime(user.updatedAt)
    }));

    return this.generateFile(formattedData, 'users', format);
  }

  static async exportCourses(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const courses = await prisma.course.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true }
        },
        teachers: {
          include: {
            teacher: {
              select: { name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            enrollments: true,
            assessments: true,
            quizzes: true,
            liveLectures: true,
            recordedLectures: true,
            certificates: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = courses.map(course => ({
      'Course ID': course.id,
      'Title': course.title,
      'Description': course.description || '',
      'Start Date': this.formatDate(course.startDate),
      'End Date': this.formatDate(course.endDate),
      'Status': course.isActive ? 'Active' : 'Inactive',
      'Published': course.isPublished ? 'Yes' : 'No',
      'Deleted': course.isDeleted ? 'Yes' : 'No',
      'Created By': course.createdBy.name,
      'Creator Email': course.createdBy.email,
      'Assigned Teachers': course.teachers.map(t => t.teacher.name).join(', '),
      'Teacher Emails': course.teachers.map(t => t.teacher.email).join(', '),
      'Enrolled Students': course._count.enrollments,
      'Assessments': course._count.assessments,
      'Quizzes': course._count.quizzes,
      'Live Lectures': course._count.liveLectures,
      'Recorded Lectures': course._count.recordedLectures,
      'Certificates Issued': course._count.certificates,
      'Created On': this.formatDateTime(course.createdAt),
      'Last Updated': this.formatDateTime(course.updatedAt)
    }));

    return this.generateFile(formattedData, 'courses', format);
  }

  static async exportAssessments(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const assessments = await prisma.assessment.findMany({
      include: {
        course: {
          select: { title: true }
        },
        createdBy: {
          select: { name: true, email: true }
        },
        assignedAssistants: {
          include: {
            assistant: {
              select: { name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            submissions: true,
            questions: true
          }
        }
      },
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = assessments.map(assessment => ({
      'Assessment ID': assessment.id,
      'Title': assessment.title,
      'Description': assessment.description || '',
      'Course': assessment.course.title,
      'Due Date': this.formatDateTime(assessment.dueDate),
      'Total Marks': assessment.totalMarks,
      'Submission Type': assessment.submissionType,
      'Created By': assessment.createdBy.name,
      'Creator Email': assessment.createdBy.email,
      'Assigned Assistants': assessment.assignedAssistants.map(a => a.assistant.name).join(', '),
      'Assistant Emails': assessment.assignedAssistants.map(a => a.assistant.email).join(', '),
      'Total Submissions': assessment._count.submissions,
      'Questions Count': assessment._count.questions,
      'Created On': this.formatDateTime(assessment.createdAt),
      'Last Updated': this.formatDateTime(assessment.updatedAt)
    }));

    return this.generateFile(formattedData, 'assessments', format);
  }

  static async exportAssessmentSubmissions(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const submissions = await prisma.assessmentSubmission.findMany({
      include: {
        assessment: {
          select: { title: true, totalMarks: true }
        },
        student: {
          select: { name: true, email: true, collegese_lms_id: true }
        },
        gradedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const formattedData = submissions.map(submission => ({
      'Submission ID': submission.id,
      'Assessment': submission.assessment.title,
      'Student Name': submission.student.name,
      'Student Email': submission.student.email,
      'Student LMS ID': submission.student.collegese_lms_id || '',
      'Status': submission.status,
      'Submitted At': this.formatDateTime(submission.submittedAt),
      'Grade': submission.grade || '',
      'Total Marks': submission.assessment.totalMarks,
      'Percentage': submission.grade ? `${((submission.grade / submission.assessment.totalMarks) * 100).toFixed(2)}%` : '',
      'Feedback': submission.feedback || '',
      'Graded By': submission.gradedBy?.name || '',
      'Graded At': this.formatDateTime(submission.gradedAt),
      'File URL': submission.fileUrl || '',
      'Text Content': submission.textContent || ''
    }));

    return this.generateFile(formattedData, 'assessment-submissions', format);
  }

  static async exportQuizzes(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const quizzes = await prisma.quiz.findMany({
      include: {
        course: {
          select: { title: true }
        },
        createdBy: {
          select: { name: true, email: true }
        },
        _count: {
          select: {
            questions: true,
            submissions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = quizzes.map(quiz => ({
      'Quiz ID': quiz.id,
      'Title': quiz.title,
      'Description': quiz.description || '',
      'Course': quiz.course?.title || 'No Course',
      'Status': quiz.status,
      'Time Limit (minutes)': quiz.timeLimit || '',
      'Total Marks': quiz.totalMarks || '',
      'Version': quiz.version,
      'Is Latest': quiz.isLatest ? 'Yes' : 'No',
      'Answer Reveal Policy': quiz.answerRevealPolicy,
      'Negative Marking': quiz.negativeMarkingValue || '',
      'Created By': quiz.createdBy.name,
      'Creator Email': quiz.createdBy.email,
      'Questions Count': quiz._count.questions,
      'Submissions Count': quiz._count.submissions,
      'Created On': this.formatDateTime(quiz.createdAt),
      'Last Updated': this.formatDateTime(quiz.updatedAt)
    }));

    return this.generateFile(formattedData, 'quizzes', format);
  }

  static async exportQuizSubmissions(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const submissions = await prisma.quizSubmission.findMany({
      include: {
        quiz: {
          select: { title: true, totalMarks: true }
        },
        user: {
          select: { name: true, email: true, collegese_lms_id: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const formattedData = submissions.map(submission => ({
      'Submission ID': submission.id,
      'Quiz': submission.quiz.title,
      'Student Name': submission.user.name,
      'Student Email': submission.user.email,
      'Student LMS ID': submission.user.collegese_lms_id || '',
      'Score': submission.score || 0,
      'Total Marks': submission.quiz.totalMarks || 0,
      'Percentage': submission.quiz.totalMarks ? `${((submission.score || 0) / submission.quiz.totalMarks * 100).toFixed(2)}%` : '',
      'Status': submission.status,
      'Start Time': this.formatDateTime(submission.startTime),
      'End Time': this.formatDateTime(submission.endTime),
      'Submitted At': this.formatDateTime(submission.submittedAt)
    }));

    return this.generateFile(formattedData, 'quiz-submissions', format);
  }

  static async exportCertificates(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const certificates = await prisma.certificate.findMany({
      include: {
        user: {
          select: { name: true, email: true, collegese_lms_id: true }
        },
        course: {
          select: { title: true }
        },
        issuedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });

    const formattedData = certificates.map(certificate => ({
      'Certificate ID': certificate.id,
      'Title': certificate.title,
      'Student Name': certificate.user.name,
      'Student Email': certificate.user.email,
      'Student LMS ID': certificate.user.collegese_lms_id || '',
      'Course': certificate.course.title,
      'Certificate URL': certificate.certificateUrl || '',
      'Issued By': certificate.issuedBy?.name || 'System',
      'Issuer Email': certificate.issuedBy?.email || '',
      'Issued At': this.formatDateTime(certificate.issuedAt)
    }));

    return this.generateFile(formattedData, 'certificates', format);
  }

  static async exportLiveLectures(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const lectures = await prisma.liveLecture.findMany({
      include: {
        course: {
          select: { title: true }
        },
        teacher: {
          select: { name: true, email: true }
        },
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    const formattedData = lectures.map(lecture => ({
      'Lecture ID': lecture.id,
      'Title': lecture.title,
      'Course': lecture.course?.title || 'No Course',
      'Teacher': lecture.teacher.name,
      'Teacher Email': lecture.teacher.email,
      'Start Time': this.formatDateTime(lecture.startTime),
      'End Time': this.formatDateTime(lecture.endTime),
      'Room ID': lecture.roomId,
      'Active': lecture.isActive ? 'Yes' : 'No',
      'Participants Count': lecture._count.participants,
      'Created On': this.formatDateTime(lecture.createdAt),
      'Last Updated': this.formatDateTime(lecture.updatedAt)
    }));

    return this.generateFile(formattedData, 'live-lectures', format);
  }

  static async exportNotifications(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const notifications = await prisma.notification.findMany({
      include: {
        recipient: {
          select: { name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedData = notifications.map(notification => ({
      'Notification ID': notification.id,
      'Type': notification.type,
      'Title': notification.title,
      'Message': notification.message,
      'Recipient Name': notification.recipient.name,
      'Recipient Email': notification.recipient.email,
      'Recipient Role': notification.recipient.role,
      'Read': notification.isRead ? 'Yes' : 'No',
      'Metadata': this.parseJSON(notification.metadata),
      'Created At': this.formatDateTime(notification.createdAt),
      'Updated At': this.formatDateTime(notification.updatedAt)
    }));

    return this.generateFile(formattedData, 'notifications', format);
  }

  static async exportEnrollments(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const enrollments = await prisma.courseEnrollment.findMany({
      include: {
        user: {
          select: { name: true, email: true, collegese_lms_id: true, role: true }
        },
        course: {
          select: { title: true }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    const formattedData = enrollments.map(enrollment => ({
      'Enrollment ID': enrollment.id,
      'Student Name': enrollment.user.name,
      'Student Email': enrollment.user.email,
      'Student LMS ID': enrollment.user.collegese_lms_id || '',
      'Student Role': enrollment.user.role,
      'Course': enrollment.course?.title || 'Unknown Course',
      'Progress %': enrollment.progress,
      'Status': enrollment.status,
      'Enrolled At': this.formatDateTime(enrollment.enrolledAt),
      'Created At': this.formatDateTime(enrollment.createdAt),
      'Last Updated': this.formatDateTime(enrollment.updatedAt)
    }));

    return this.generateFile(formattedData, 'enrollments', format);
  }

  static async exportSystemStats(format: 'csv' | 'xlsx' = 'csv'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const stats = [
      {
        'Metric': 'Total Users',
        'Value': await prisma.user.count(),
        'Description': 'Total registered users in the system'
      },
      {
        'Metric': 'Total Students',
        'Value': await prisma.user.count({ where: { role: Role.STUDENT } }),
        'Description': 'Users with student role'
      },
      {
        'Metric': 'Total Teachers',
        'Value': await prisma.user.count({ where: { role: Role.TEACHER } }),
        'Description': 'Users with teacher role'
      },
      {
        'Metric': 'Total Assistants',
        'Value': await prisma.user.count({ where: { role: Role.ASSISTANT } }),
        'Description': 'Users with assistant role'
      },
      {
        'Metric': 'Total Admins',
        'Value': await prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } } }),
        'Description': 'Users with admin or super admin role'
      },
      {
        'Metric': 'New Users This Month',
        'Value': await prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
        'Description': 'Users registered this month'
      },
      {
        'Metric': 'New Users This Week',
        'Value': await prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
        'Description': 'Users registered this week'
      },
      {
        'Metric': 'Total Courses',
        'Value': await prisma.course.count({ where: { isDeleted: false } }),
        'Description': 'Active courses in the system'
      },
      {
        'Metric': 'Published Courses',
        'Value': await prisma.course.count({ where: { isPublished: true, isDeleted: false } }),
        'Description': 'Courses that are published and active'
      },
      {
        'Metric': 'Total Enrollments',
        'Value': await prisma.courseEnrollment.count(),
        'Description': 'Total course enrollments'
      },
      {
        'Metric': 'Total Assessments',
        'Value': await prisma.assessment.count({ where: { isDeleted: false } }),
        'Description': 'Active assessments in the system'
      },
      {
        'Metric': 'Assessment Submissions',
        'Value': await prisma.assessmentSubmission.count(),
        'Description': 'Total assessment submissions'
      },
      {
        'Metric': 'Graded Submissions',
        'Value': await prisma.assessmentSubmission.count({ where: { status: GradeStatus.GRADED } }),
        'Description': 'Assessment submissions that have been graded'
      },
      {
        'Metric': 'Total Quizzes',
        'Value': await prisma.quiz.count(),
        'Description': 'Total quizzes in the system'
      },
      {
        'Metric': 'Quiz Submissions',
        'Value': await prisma.quizSubmission.count(),
        'Description': 'Total quiz submissions'
      },
      {
        'Metric': 'Certificates Issued',
        'Value': await prisma.certificate.count(),
        'Description': 'Total certificates issued'
      },
      {
        'Metric': 'Live Lectures',
        'Value': await prisma.liveLecture.count(),
        'Description': 'Total live lectures scheduled'
      },
      {
        'Metric': 'Recorded Lectures',
        'Value': await prisma.recordedLecture.count(),
        'Description': 'Total recorded lectures'
      },
      {
        'Metric': 'Total Notifications',
        'Value': await prisma.notification.count(),
        'Description': 'Total notifications sent'
      },
      {
        'Metric': 'Unread Notifications',
        'Value': await prisma.notification.count({ where: { isRead: false } }),
        'Description': 'Notifications that are unread'
      }
    ];

    const formattedData = stats.map(stat => ({
      ...stat,
      'Generated At': this.formatDateTime(now)
    }));

    return this.generateFile(formattedData, 'system-statistics', format);
  }

  private static generateFile(data: any[], filename: string, format: 'csv' | 'xlsx'): { data: Buffer; filename: string; contentType: string } {
    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data'); 
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return {
        data: buffer,
        filename: `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } else {
      if (data.length === 0) {
        return {
          data: Buffer.from('No data available'),
          filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
          contentType: 'text/csv'
        };
      }
      const parser = new Parser();
      const csv = parser.parse(data);
      return {
        data: Buffer.from(csv),
        filename: `${filename}_${new Date().toISOString().split('T')[0]}.csv`,
        contentType: 'text/csv'
      };
    }
  }

  static async exportAllData(format: 'csv' | 'xlsx' = 'xlsx'): Promise<{ data: Buffer; filename: string; contentType: string }> {
    if (format === 'csv') {
      throw new Error('All data export in CSV format is not supported. Please use XLSX format for comprehensive export.');
    }
    const workbook = XLSX.utils.book_new();
    const [users, courses, assessments, submissions, quizzes, quizSubmissions, certificates, lectures, notifications, enrollments] = await Promise.all([
      this.getUsersData(),
      this.getCoursesData(),
      this.getAssessmentsData(),
      this.getAssessmentSubmissionsData(),
      this.getQuizzesData(),
      this.getQuizSubmissionsData(),
      this.getCertificatesData(),
      this.getLiveLecturesData(),
      this.getNotificationsData(),
      this.getEnrollmentsData()
    ]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(users), 'Users');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(courses), 'Courses');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assessments), 'Assessments');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(submissions), 'Assessment Submissions');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quizzes), 'Quizzes');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(quizSubmissions), 'Quiz Submissions');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(certificates), 'Certificates');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lectures), 'Live Lectures');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(notifications), 'Notifications');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(enrollments), 'Enrollments');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      data: buffer,
      filename: `lms_complete_export_${new Date().toISOString().split('T')[0]}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  private static async getUsersData() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        collegese_lms_id: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        year: true,
        courseName: true,
        Gender: true,
        dateOfBirth: true,
        address: true,
        guardianPhone: true,
        attendancePercentage: true,
        grade: true,
        completedCourse: true,
        isVerified: true,
        isSuspended: true,
        isDeleted: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            enrollments: true,
            teachingCourses: true,
            createdCourses: true,
            certificates: true,
            assessmentSubmissions: true,
            quizSubmissions: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(user => ({
      'User ID': user.id,
      'Name': user.name,
      'LMS ID': user.collegese_lms_id || '',
      'Email': user.email,
      'Phone': user.phone || '',
      'Role': user.role,
      'Department': user.department || '',
      'Year': user.year || '',
      'Course Name': user.courseName || '',
      'Gender': user.Gender || '',
      'Date of Birth': this.formatDate(user.dateOfBirth),
      'Address': user.address || '',
      'Guardian Phone': user.guardianPhone || '',
      'Attendance %': user.attendancePercentage || 0,
      'Grade': user.grade || '',
      'Course Completed': user.completedCourse ? 'Yes' : 'No',
      'Verified': user.isVerified ? 'Yes' : 'No',
      'Suspended': user.isSuspended ? 'Yes' : 'No',
      'Deleted': user.isDeleted ? 'Yes' : 'No',
      'Last Login': this.formatDateTime(user.lastLogin),
      'Enrollments Count': user._count.enrollments,
      'Teaching Courses': user._count.teachingCourses,
      'Created Courses': user._count.createdCourses,
      'Certificates': user._count.certificates,
      'Assessment Submissions': user._count.assessmentSubmissions,
      'Quiz Submissions': user._count.quizSubmissions,
      'Registered On': this.formatDateTime(user.createdAt),
      'Last Updated': this.formatDateTime(user.updatedAt)
    }));
  }

  private static async getCoursesData() {
    const courses = await prisma.course.findMany({
      include: {
        createdBy: {
          select: { name: true, email: true }
        },
        teachers: {
          include: {
            teacher: {
              select: { name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            enrollments: true,
            assessments: true,
            quizzes: true,
            liveLectures: true,
            recordedLectures: true,
            certificates: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return courses.map(course => ({
      'Course ID': course.id,
      'Title': course.title,
      'Description': course.description || '',
      'Start Date': this.formatDate(course.startDate),
      'End Date': this.formatDate(course.endDate),
      'Status': course.isActive ? 'Active' : 'Inactive',
      'Published': course.isPublished ? 'Yes' : 'No',
      'Deleted': course.isDeleted ? 'Yes' : 'No',
      'Created By': course.createdBy.name,
      'Creator Email': course.createdBy.email,
      'Assigned Teachers': course.teachers.map(t => t.teacher.name).join(', '),
      'Teacher Emails': course.teachers.map(t => t.teacher.email).join(', '),
      'Enrolled Students': course._count.enrollments,
      'Assessments': course._count.assessments,
      'Quizzes': course._count.quizzes,
      'Live Lectures': course._count.liveLectures,
      'Recorded Lectures': course._count.recordedLectures,
      'Certificates Issued': course._count.certificates,
      'Created On': this.formatDateTime(course.createdAt),
      'Last Updated': this.formatDateTime(course.updatedAt)
    }));
  }

  private static async getAssessmentsData() {
    const assessments = await prisma.assessment.findMany({
      include: {
        course: {
          select: { title: true }
        },
        createdBy: {
          select: { name: true, email: true }
        },
        assignedAssistants: {
          include: {
            assistant: {
              select: { name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            submissions: true,
            questions: true
          }
        }
      },
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' }
    });

    return assessments.map(assessment => ({
      'Assessment ID': assessment.id,
      'Title': assessment.title,
      'Description': assessment.description || '',
      'Course': assessment.course.title,
      'Due Date': this.formatDateTime(assessment.dueDate),
      'Total Marks': assessment.totalMarks,
      'Submission Type': assessment.submissionType,
      'Created By': assessment.createdBy.name,
      'Creator Email': assessment.createdBy.email,
      'Assigned Assistants': assessment.assignedAssistants.map(a => a.assistant.name).join(', '),
      'Assistant Emails': assessment.assignedAssistants.map(a => a.assistant.email).join(', '),
      'Total Submissions': assessment._count.submissions,
      'Questions Count': assessment._count.questions,
      'Created On': this.formatDateTime(assessment.createdAt),
      'Last Updated': this.formatDateTime(assessment.updatedAt)
    }));
  }

  private static async getAssessmentSubmissionsData() {
    const submissions = await prisma.assessmentSubmission.findMany({
      include: {
        assessment: {
          select: { title: true, totalMarks: true }
        },
        student: {
          select: { name: true, email: true, collegese_lms_id: true }
        },
        gradedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return submissions.map(submission => ({
      'Submission ID': submission.id,
      'Assessment': submission.assessment.title,
      'Student Name': submission.student.name,
      'Student Email': submission.student.email,
      'Student LMS ID': submission.student.collegese_lms_id || '',
      'Status': submission.status,
      'Submitted At': this.formatDateTime(submission.submittedAt),
      'Grade': submission.grade || '',
      'Total Marks': submission.assessment.totalMarks,
      'Percentage': submission.grade ? `${((submission.grade / submission.assessment.totalMarks) * 100).toFixed(2)}%` : '',
      'Feedback': submission.feedback || '',
      'Graded By': submission.gradedBy?.name || '',
      'Graded At': this.formatDateTime(submission.gradedAt),
      'File URL': submission.fileUrl || '',
      'Text Content': submission.textContent || ''
    }));
  }

  private static async getQuizzesData() {
    const quizzes = await prisma.quiz.findMany({
      include: {
        course: {
          select: { title: true }
        },
        createdBy: {
          select: { name: true, email: true }
        },
        _count: {
          select: {
            questions: true,
            submissions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return quizzes.map(quiz => ({
      'Quiz ID': quiz.id,
      'Title': quiz.title,
      'Description': quiz.description || '',
      'Course': quiz.course?.title || 'No Course',
      'Status': quiz.status,
      'Time Limit (minutes)': quiz.timeLimit || '',
      'Total Marks': quiz.totalMarks || '',
      'Version': quiz.version,
      'Is Latest': quiz.isLatest ? 'Yes' : 'No',
      'Answer Reveal Policy': quiz.answerRevealPolicy,
      'Negative Marking': quiz.negativeMarkingValue || '',
      'Created By': quiz.createdBy.name,
      'Creator Email': quiz.createdBy.email,
      'Questions Count': quiz._count.questions,
      'Submissions Count': quiz._count.submissions,
      'Created On': this.formatDateTime(quiz.createdAt),
      'Last Updated': this.formatDateTime(quiz.updatedAt)
    }));
  }

  private static async getQuizSubmissionsData() {
    const submissions = await prisma.quizSubmission.findMany({
      include: {
        quiz: {
          select: { title: true, totalMarks: true }
        },
        user: {
          select: { name: true, email: true, collegese_lms_id: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return submissions.map(submission => ({
      'Submission ID': submission.id,
      'Quiz': submission.quiz.title,
      'Student Name': submission.user.name,
      'Student Email': submission.user.email,
      'Student LMS ID': submission.user.collegese_lms_id || '',
      'Score': submission.score || 0,
      'Total Marks': submission.quiz.totalMarks || 0,
      'Percentage': submission.quiz.totalMarks ? `${((submission.score || 0) / submission.quiz.totalMarks * 100).toFixed(2)}%` : '',
      'Status': submission.status,
      'Start Time': this.formatDateTime(submission.startTime),
      'End Time': this.formatDateTime(submission.endTime),
      'Submitted At': this.formatDateTime(submission.submittedAt)
    }));
  }

  private static async getCertificatesData() {
    const certificates = await prisma.certificate.findMany({
      include: {
        user: {
          select: { name: true, email: true, collegese_lms_id: true }
        },
        course: {
          select: { title: true }
        },
        issuedBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });

    return certificates.map(certificate => ({
      'Certificate ID': certificate.id,
      'Title': certificate.title,
      'Student Name': certificate.user.name,
      'Student Email': certificate.user.email,
      'Student LMS ID': certificate.user.collegese_lms_id || '',
      'Course': certificate.course.title,
      'Certificate URL': certificate.certificateUrl || '',
      'Issued By': certificate.issuedBy?.name || 'System',
      'Issuer Email': certificate.issuedBy?.email || '',
      'Issued At': this.formatDateTime(certificate.issuedAt)
    }));
  }

  private static async getLiveLecturesData() {
    const lectures = await prisma.liveLecture.findMany({
      include: {
        course: {
          select: { title: true }
        },
        teacher: {
          select: { name: true, email: true }
        },
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    return lectures.map(lecture => ({
      'Lecture ID': lecture.id,
      'Title': lecture.title,
      'Course': lecture.course?.title || 'No Course',
      'Teacher': lecture.teacher.name,
      'Teacher Email': lecture.teacher.email,
      'Start Time': this.formatDateTime(lecture.startTime),
      'End Time': this.formatDateTime(lecture.endTime),
      'Room ID': lecture.roomId,
      'Active': lecture.isActive ? 'Yes' : 'No',
      'Participants Count': lecture._count.participants,
      'Created On': this.formatDateTime(lecture.createdAt),
      'Last Updated': this.formatDateTime(lecture.updatedAt)
    }));
  }

  private static async getNotificationsData() {
    const notifications = await prisma.notification.findMany({
      include: {
        recipient: {
          select: { name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return notifications.map(notification => ({
      'Notification ID': notification.id,
      'Type': notification.type,
      'Title': notification.title,
      'Message': notification.message,
      'Recipient Name': notification.recipient.name,
      'Recipient Email': notification.recipient.email,
      'Recipient Role': notification.recipient.role,
      'Read': notification.isRead ? 'Yes' : 'No',
      'Metadata': this.parseJSON(notification.metadata),
      'Created At': this.formatDateTime(notification.createdAt),
      'Updated At': this.formatDateTime(notification.updatedAt)
    }));
  }

  private static async getEnrollmentsData() {
    const enrollments = await prisma.courseEnrollment.findMany({
      include: {
        user: {
          select: { name: true, email: true, collegese_lms_id: true, role: true }
        },
        course: {
          select: { title: true }
        }
      },
      orderBy: { enrolledAt: 'desc' }
    });

    return enrollments.map(enrollment => ({
      'Enrollment ID': enrollment.id,
      'Student Name': enrollment.user.name,
      'Student Email': enrollment.user.email,
      'Student LMS ID': enrollment.user.collegese_lms_id || '',
      'Student Role': enrollment.user.role,
      'Course': enrollment.course?.title || 'Unknown Course',
      'Progress %': enrollment.progress,
      'Status': enrollment.status,
      'Enrolled At': this.formatDateTime(enrollment.enrolledAt),
      'Created At': this.formatDateTime(enrollment.createdAt),
      'Last Updated': this.formatDateTime(enrollment.updatedAt)
    }));
  }
}
