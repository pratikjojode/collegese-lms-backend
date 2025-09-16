import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { isAdmin } from "middlewares/adminAuth/admin.auth.middleware";
import { 
  createLiveLecture, 
  getLectureParticipants, 
  getLiveLectureById, 
  getLiveLecturesByCourse, 
  getLiveLecturesByTeacher, 
  getStudentLiveLectures, 
  joinLecture 
} from "controllers/liveLecture/liveLecture.controller";

const router = Router();


router.get("/student-live-lectures", authMiddleware, getStudentLiveLectures);
router.post("/live", authMiddleware, isAdmin, createLiveLecture);
router.get("/teacher/:teacherId", authMiddleware, getLiveLecturesByTeacher);
router.get("/course/:courseId", authMiddleware, getLiveLecturesByCourse);
router.post("/join/:lectureId", authMiddleware, joinLecture);
router.get("/participants/:lectureId", authMiddleware, getLectureParticipants);


router.get("/:lectureId", authMiddleware, getLiveLectureById);

export default router;