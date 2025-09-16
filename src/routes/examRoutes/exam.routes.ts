import { Router } from "express";
import { 
  createExam, 
  deleteExam, 
  getAttemptsByUser, 
  getExamById, 
  getExamsByCourse, 
  startExam, 
  submitExam, 
  updateExam,
  getExamStats,
  createQuestion,
  bulkCreateQuestions,
  getQuestionsByExam,
  updateQuestion,
  deleteQuestion,
  getAllExams,
  getExamAttemptStatus,
  getPassedExamsUser,
  getFailedUsersForExam,
  getPendingEvaluations,
  evaluateSubjectiveAnswers,
  uploadExamRecording,
  getMyExamAttempts,
  sendBulkExamResults,
  getExamAttemptById,
  getExamRecordingPresignedUrl,
  
} from "controllers/exam/exam.controller";

import { authMiddleware } from "middlewares/auth.middleware";
import { uploadVideo } from "middlewares/multer.middleware";
import { isAssistant } from "middlewares/adminAuth/admin.auth.middleware";

const ExamRouter = Router();



ExamRouter.get("/pending-evaluations", authMiddleware, getPendingEvaluations);
ExamRouter.get("/attempts/me", authMiddleware, getAttemptsByUser);
ExamRouter.get(
  '/recordings/presigned-url',
  authMiddleware,
isAssistant,
  getExamRecordingPresignedUrl
);
ExamRouter.post("/send-results", authMiddleware, sendBulkExamResults);
ExamRouter.get("/mine", authMiddleware, getMyExamAttempts);


ExamRouter.post("/attempt/:attemptId/submit", authMiddleware, submitExam);
ExamRouter.post("/attempt/:attemptId/evaluate", authMiddleware, evaluateSubjectiveAnswers);
ExamRouter.get("/:examId/attempt/status", authMiddleware, getExamAttemptStatus);
ExamRouter.get("/attempt/:attemptId", authMiddleware, getExamAttemptById);


ExamRouter.get("/:id/passed-users", authMiddleware, getPassedExamsUser);
ExamRouter.get("/:id/failed-users", authMiddleware, getFailedUsersForExam);
ExamRouter.get("/:examId/stats", authMiddleware, getExamStats);


ExamRouter.post("/", authMiddleware, createExam);
ExamRouter.get("/course/:courseId", authMiddleware, getExamsByCourse);
ExamRouter.get("/", authMiddleware, getAllExams);

ExamRouter.post("/:examId/start", authMiddleware, startExam);
ExamRouter.post(
  "/attempt/:attemptId/recording",
  authMiddleware,
  uploadVideo,
  uploadExamRecording
);




ExamRouter.get("/:examId", authMiddleware, getExamById);
ExamRouter.put("/:examId", authMiddleware, updateExam);
ExamRouter.delete("/:examId", authMiddleware, deleteExam);


ExamRouter.post("/:examId/questions", authMiddleware, createQuestion);
ExamRouter.post("/:examId/questions/bulk", authMiddleware, bulkCreateQuestions);
ExamRouter.get("/:examId/questions", authMiddleware, getQuestionsByExam);
ExamRouter.put("/questions/:questionId", authMiddleware, updateQuestion);
ExamRouter.delete("/questions/:questionId", authMiddleware, deleteQuestion);

export default ExamRouter;
