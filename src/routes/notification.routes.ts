import express from 'express';
import { getNotificationsController, markNotificationReadController, markAllNotificationsReadController } from '../controllers/notification/notification.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.use(authMiddleware);
router.get('/', getNotificationsController);
router.patch('/:notificationId/read', markNotificationReadController);
router.patch('/read-all', markAllNotificationsReadController);

export { router as notificationRoutes };
