import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { isSuperAdmin, isAdmin, isTeacher, isAssistant } from '../middlewares/adminAuth/admin.auth.middleware'; 
import {
    promoteUserController,
    setSystemSettingsController,
    getSystemSettingsController,getUsersController,
    getAllExamScores,
    toggleMaintenanceMode,
    updateMaintenanceWhitelist
} from '../controllers/superadmin.controller';
import { ExportController } from '../controllers/export.controller';


const superAdminRouter = Router();

superAdminRouter.use(authMiddleware); 
superAdminRouter.get("/exams/scores", isAssistant, authMiddleware, getAllExamScores);
superAdminRouter.post('/users/:userId/promote', isSuperAdmin, promoteUserController);
superAdminRouter.get('/settings/system', isAdmin, getSystemSettingsController);
superAdminRouter.put('/settings/system', isAdmin, setSystemSettingsController);
superAdminRouter.get('/users', isSuperAdmin, getUsersController);
superAdminRouter.put('/settings/maintenance', isSuperAdmin, toggleMaintenanceMode);
superAdminRouter.put(
  "/settings/maintenance/whitelist",
  isSuperAdmin,
  updateMaintenanceWhitelist
);
superAdminRouter.get('/export', isSuperAdmin, ExportController.getExportMenu);
superAdminRouter.get('/export/users', isSuperAdmin, ExportController.exportUsers);
superAdminRouter.get('/export/courses', isSuperAdmin, ExportController.exportCourses);
superAdminRouter.get('/export/assessments', isSuperAdmin, ExportController.exportAssessments);
superAdminRouter.get('/export/assessment-submissions', isSuperAdmin, ExportController.exportAssessmentSubmissions);
superAdminRouter.get('/export/quizzes', isSuperAdmin, ExportController.exportQuizzes);
superAdminRouter.get('/export/quiz-submissions', isSuperAdmin, ExportController.exportQuizSubmissions);
superAdminRouter.get('/export/certificates', isSuperAdmin, ExportController.exportCertificates);
superAdminRouter.get('/export/live-lectures', isSuperAdmin, ExportController.exportLiveLectures);
superAdminRouter.get('/export/notifications', isSuperAdmin, ExportController.exportNotifications);
superAdminRouter.get('/export/enrollments', isSuperAdmin, ExportController.exportEnrollments);
superAdminRouter.get('/export/system-stats', isSuperAdmin, ExportController.exportSystemStats);
superAdminRouter.get('/export/complete', isSuperAdmin, ExportController.exportAllData);


export default superAdminRouter;