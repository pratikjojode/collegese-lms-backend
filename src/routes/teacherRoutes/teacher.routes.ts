import { deleteTeacherLecture, getEnrolledStudentsCount, getTeacherCourses, getTeacherLectures, updateTeacherLecture } from 'controllers/teachers/teacher.controller';

import { Router } from 'express';
import { isTeacher } from 'middlewares/adminAuth/admin.auth.middleware';
import { authMiddleware } from 'middlewares/auth.middleware';

const teacherRouter = Router();

teacherRouter.get(
  '/:teacherId/courses',
  authMiddleware,
  getTeacherCourses
);

teacherRouter.get(
  '/:teacherId/enrolled-students',
  authMiddleware,
  getEnrolledStudentsCount
);

teacherRouter.get(
  '/:teacherId/lectures',
  authMiddleware,
  isTeacher,
  getTeacherLectures
);

teacherRouter.put(
  '/:teacherId/lectures/:lectureId',
  authMiddleware,
  isTeacher,
  updateTeacherLecture
);

teacherRouter.delete(
  '/:teacherId/lectures/:lectureId',
  authMiddleware,
  isTeacher,
  deleteTeacherLecture
);

export default teacherRouter;