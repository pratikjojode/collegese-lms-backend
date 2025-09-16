import {  getAdminCourseStats,getAdminCourseEnrollments,getDashboardStats, getTeacherCourseEnrollments, getStudentOverview, getStudentQuizTrend, getStudentAssessmentStatus, getStudentLiveLecturesAnalytics, getStudentEnrolledCourses, syncStudentCourseCompletion, getAdminCourseProgress  } from 'controllers/statistics/stats.controller';
import { Router } from 'express';
import { authMiddleware } from 'middlewares/auth.middleware';
import { isStudent, isSuperAdmin } from 'middlewares/adminAuth/admin.auth.middleware';


const statsRouter = Router();


statsRouter.get('/', authMiddleware,getDashboardStats);
statsRouter.get('/teacher/courses/enrollments', authMiddleware, getTeacherCourseEnrollments);
statsRouter.get('/student/overview', authMiddleware, isStudent, getStudentOverview);
statsRouter.get('/student/quiz-trend', authMiddleware, isStudent, getStudentQuizTrend);
statsRouter.get('/student/assessments', authMiddleware, isStudent, getStudentAssessmentStatus);
statsRouter.get('/student/live-lectures', authMiddleware, isStudent, getStudentLiveLecturesAnalytics);
statsRouter.get('/student/enrolled-courses', authMiddleware, isStudent, getStudentEnrolledCourses);
statsRouter.post('/student/sync-completion', authMiddleware, isStudent, syncStudentCourseCompletion);
statsRouter.get('/admin/course-progress/:courseId/:userId', authMiddleware, isSuperAdmin, getAdminCourseProgress);
statsRouter.get('/admin/enrollments/:courseId', authMiddleware, isSuperAdmin, getAdminCourseEnrollments);
statsRouter.get('/admin/course-stats/:courseId', authMiddleware, isSuperAdmin, getAdminCourseStats);

export default statsRouter;