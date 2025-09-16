import { Router } from 'express';
import { bulkRegisterUsers } from '../../controllers/adminbulkreg.controller';
import { createUserController, getAllUsersController, getUserByIdController, updateUserController, deleteUserController, getAllSessionsController, getAdminEnrollmentsController,findUserByEmailController,assignTeacherToCourseController   } from '../../controllers/adminUser.controller';
import { isAdmin } from '../../middlewares/adminAuth/admin.auth.middleware';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadExcel } from '../../middlewares/multer.middleware';
import { isSuperAdmin } from 'middlewares/adminAuth/admin.auth.middleware';
import courseRouter from './course.routes';
import { getUserSessionsByAdminController } from 'controllers/users/user.controller';


const adminRouter = Router();

adminRouter.post('/register/bulk', authMiddleware, isAdmin, uploadExcel, bulkRegisterUsers);

adminRouter.use('/courses', courseRouter);


adminRouter.get(
  '/sessions',
    authMiddleware,
  isAdmin,
  getAllSessionsController
);

adminRouter.get(
  '/users/:userId/sessions',
  
  getUserSessionsByAdminController
);
adminRouter.post('/users', authMiddleware, isAdmin, createUserController); 
adminRouter.get("/all", authMiddleware, getAllUsersController);

adminRouter.get('/users/all', authMiddleware, isAdmin, getAllUsersController);

adminRouter.get('/users/:id', authMiddleware, isAdmin, getUserByIdController);

adminRouter.put('/users/:id', authMiddleware, isAdmin, updateUserController);

adminRouter.post('/users/find-by-email', authMiddleware, isAdmin, findUserByEmailController);

courseRouter.post('/:courseId/assign-teacher', authMiddleware, isAdmin, assignTeacherToCourseController);

adminRouter.delete('/users/:id', authMiddleware, isSuperAdmin, deleteUserController);

adminRouter.get('/enrollments/all', authMiddleware, isAdmin, getAdminEnrollmentsController);
export default adminRouter; 