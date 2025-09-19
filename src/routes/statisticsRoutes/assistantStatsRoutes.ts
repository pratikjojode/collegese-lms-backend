import { getAssistantDashboard } from "controllers/statistics/assistantStatsController";
import { Router } from "express";
import { isAssistant } from "middlewares/adminAuth/admin.auth.middleware";
import { authMiddleware } from "middlewares/auth.middleware";


const assistantStatsRouter = Router();

assistantStatsRouter.get("/", authMiddleware, isAssistant, getAssistantDashboard);

export default assistantStatsRouter;
