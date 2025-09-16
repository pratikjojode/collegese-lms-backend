import { getAssessmentCompletionStatus, getQuizCompletionStatus, getUserProfile, getUserSessionsController, logoutSessionByIdController, updateUserProfileController,  } from 'controllers/users/user.controller';
import { getCurrentUserCoursesController } from '../../controllers/course/course.controller';
import express from 'express';
import { authMiddleware } from 'middlewares/auth.middleware';
import courseRoute from '../adminRoutes/course.routes';
import { uploadProfilePic } from 'middlewares/multer.middleware';
const userRouter = express.Router();

userRouter.get(
  '/sessions',
  authMiddleware,
  getUserSessionsController
);
userRouter.delete(
  '/sessions/:id',
  authMiddleware,
  logoutSessionByIdController
);

userRouter.get('/profile',authMiddleware,getUserProfile)
userRouter.get('/quizzes/student/:studentId/:quizId/completion-status', getQuizCompletionStatus);
userRouter.get('/assessments/:assessmentId/student/:studentId/completion-status', getAssessmentCompletionStatus);

userRouter.put("/profile", authMiddleware, uploadProfilePic, updateUserProfileController);
userRouter.get('/courses/me', authMiddleware, getCurrentUserCoursesController);
userRouter.use('/courses', authMiddleware, courseRoute);

export default userRouter;