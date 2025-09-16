import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { isTeacher, isStudent, isAssistant, isAdmin } from '../../middlewares/adminAuth/admin.auth.middleware';
import { 
    createAssessmentController, 
    submitAssessmentController, 
    gradeAssessmentController,
    getAssessmentDetailsController,
    getSubmissionsForAssessmentController,
    getAllAssessmentsController, 
    updateAssessmentController,assignAssistantController, getAssignedAssessmentsForAssistantController,
    deleteAssessmentController,getAssessmentsByCourseController,getPresignedUrlController,getSubmissionUrlController,getAssessmentDetailsForStudentController,
    getAssessmentAnalyticsController,addBulkAssessmentQuestionsController,getMyAssessmentsController,getAssessmentsForAssistantController
} from '../../controllers/assessment/assessment.controller';

const assessmentRouter = Router();

assessmentRouter.get('/admin/all', authMiddleware, isAdmin, getAllAssessmentsController);
assessmentRouter.post('/course/:courseId', authMiddleware, isTeacher, createAssessmentController);
assessmentRouter.put('/:assessmentId', authMiddleware, isTeacher, updateAssessmentController);
assessmentRouter.delete('/:assessmentId', authMiddleware, isTeacher, deleteAssessmentController);

assessmentRouter.get('/:assessmentId/submissions', authMiddleware, isAssistant, getSubmissionsForAssessmentController);
assessmentRouter.get('/:assessmentId/analytics', authMiddleware, isAssistant, getAssessmentAnalyticsController);
assessmentRouter.put('/submission/:submissionId/grade', authMiddleware, isAssistant, gradeAssessmentController);
assessmentRouter.get('/teacher/my-assessments', authMiddleware, isTeacher, getMyAssessmentsController);
assessmentRouter.get('/assistant/all', authMiddleware, isAssistant, getAssessmentsForAssistantController);
assessmentRouter.get('/submission/:submissionId/view', authMiddleware, isAssistant, getSubmissionUrlController);

assessmentRouter.get('/:assessmentId', authMiddleware, isAssistant, getAssessmentDetailsController);
assessmentRouter.get('/student/:assessmentId', authMiddleware, isStudent, getAssessmentDetailsForStudentController);
assessmentRouter.post('/:assessmentId/submit', authMiddleware, isStudent, submitAssessmentController);
assessmentRouter.post('/:assessmentId/questions/bulk', authMiddleware, isTeacher, addBulkAssessmentQuestionsController);
assessmentRouter.get('/course/:courseId', authMiddleware, isStudent, getAssessmentsByCourseController);
assessmentRouter.post('/:assessmentId/presigned-url', authMiddleware, isStudent, getPresignedUrlController);

assessmentRouter.post('/:assessmentId/assign-assistant', authMiddleware, isTeacher, assignAssistantController);
assessmentRouter.get('/assistant/assigned', authMiddleware, isAssistant, getAssignedAssessmentsForAssistantController);

export default assessmentRouter;