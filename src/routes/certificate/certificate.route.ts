import { 
  generateCertificate, 
  verifyCertificate,
  getUserCertificates,
  getCertificateById,
  revokeCertificate,
  getAllUsersCoursesWithProgress,
  getAllCertificates,
 
  
} from "controllers/certificate/certificate.controller";
import { Router } from "express";
import { authMiddleware } from "middlewares/auth.middleware";

const certificateRouter = Router();


certificateRouter.post("/generate",authMiddleware, generateCertificate);

certificateRouter.get("/verify/:certificateId",authMiddleware, verifyCertificate);

certificateRouter.get("/", authMiddleware, getAllCertificates);

certificateRouter.get("/user/:userId",authMiddleware, getUserCertificates);
certificateRouter.get(
  "/all-users/courses-progress",
  authMiddleware,
  getAllUsersCoursesWithProgress
);

certificateRouter.get("/:id",authMiddleware,getCertificateById);

certificateRouter.delete("/:id",authMiddleware, revokeCertificate);

export default certificateRouter;