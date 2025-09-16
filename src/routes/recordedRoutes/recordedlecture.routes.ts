import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { isTeacher } from '../../middlewares/adminAuth/admin.auth.middleware';
import { uploadVideo } from '../../middlewares/multer.middleware';
import { recordedLectureController } from 'controllers/recordedLectures/recordedLecture.controller';
import { getStudentLectureProgress } from 'controllers/teachers/teacher.controller';

const recordedLectureRouter = Router();

recordedLectureRouter.post(
  '/courses/:courseId/lectures',
  authMiddleware,
  isTeacher,
  uploadVideo,
  recordedLectureController.uploadLecture
);



recordedLectureRouter.get(
  '/courses/:courseId/lectures',
  authMiddleware,
  recordedLectureController.getLecturesByCourse
);

recordedLectureRouter.get(
  '/lectures/:lectureId/signed-url',
  authMiddleware,
  recordedLectureController.getSignedUrl
);

recordedLectureRouter.get(
  '/teachers/:teacherId/lectures/:recordedLectureId/student-progress',
  authMiddleware,
  isTeacher,
  getStudentLectureProgress
);
recordedLectureRouter.put(
  '/lectures/:lectureId',
  authMiddleware,
  isTeacher,
  recordedLectureController.updateLecture
);

recordedLectureRouter.delete(
  '/lectures/:lectureId',
  authMiddleware,
  isTeacher,
  recordedLectureController.deleteLecture
);

recordedLectureRouter.post(
  '/progress/:userId/:recordedLectureId',
  authMiddleware,
  recordedLectureController.updateLectureProgress
);

recordedLectureRouter.get(
  '/progress/:userId/:recordedLectureId',
  authMiddleware,
  recordedLectureController.getLectureProgress
);



export default recordedLectureRouter;
