import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { isAdmin, isSuperAdmin, isTeacher, isAssistant, isStudent } from '../../middlewares/adminAuth/admin.auth.middleware';
import {
  createQuizController,
  addQuestionToQuizController,
  publishQuizController,
  getQuizSubmissionsController,
  gradeSubmissionController,
  getQuizAnalyticsController,
  getAvailableQuizzesController,
  startQuizAttemptController,
  getQuizAttemptQuestionsController,
  submitQuizAttemptController,
  getMySubmissionResultController,
  getQuizController,
  getQuizzesController,
  getAllQuizzesForAuditController,getQuizzesForTeacherController,getQuizDetailsForAdminController,addBulkQuestionsController, getQuizzesByCourseController,
  updateQuizController,getQuizzesForAssistantController,
  deleteQuizController
} from '../../controllers/quiz/quiz.controller';

const quizRouter = Router();

quizRouter.get('/admin/audit/all', authMiddleware, isAdmin, getAllQuizzesForAuditController);
quizRouter.get('/admin/my-quizzes', authMiddleware, isTeacher, getQuizzesForTeacherController);
quizRouter.get('/admin/:quizId/details', authMiddleware, isAssistant, getQuizDetailsForAdminController);
quizRouter.post('/admin/create', authMiddleware, isTeacher, createQuizController);
quizRouter.post('/admin/:quizId/questions', authMiddleware,isAssistant, addQuestionToQuizController);
quizRouter.put('/admin/:quizId/publish', authMiddleware, isTeacher, publishQuizController);
quizRouter.post('/admin/:quizId/questions/bulk', authMiddleware, isAssistant, addBulkQuestionsController);
quizRouter.put('/admin/:quizId/update', authMiddleware, isTeacher, updateQuizController);
quizRouter.delete('/admin/:quizId/delete', authMiddleware, isTeacher, deleteQuizController);
quizRouter.get('/student/course/:courseId', authMiddleware, isStudent, getQuizzesByCourseController);
quizRouter.get('/assistant/all', authMiddleware, isAssistant, getQuizzesForAssistantController);
quizRouter.get('/admin/:quizId/submissions', authMiddleware, isAssistant, getQuizSubmissionsController);
quizRouter.put('/admin/submissions/:submissionId/grade', authMiddleware, isAssistant, gradeSubmissionController);
quizRouter.get('/admin/:quizId/analytics', authMiddleware, isAssistant, getQuizAnalyticsController);

quizRouter.get('/student/all', authMiddleware, isStudent, getQuizzesController);
quizRouter.get('/student/available', authMiddleware, isStudent, getAvailableQuizzesController);
quizRouter.get('/student/:quizId', authMiddleware, isStudent, getQuizController);
quizRouter.post('/student/:quizId/start', authMiddleware, isStudent, startQuizAttemptController);
quizRouter.get('/student/:quizId/attempt', authMiddleware, isStudent, getQuizAttemptQuestionsController);
quizRouter.post('/student/submissions/:submissionId/submit', authMiddleware, isStudent, submitQuizAttemptController);
quizRouter.get('/student/submissions/:submissionId/result', authMiddleware, isStudent, getMySubmissionResultController);

export default quizRouter;