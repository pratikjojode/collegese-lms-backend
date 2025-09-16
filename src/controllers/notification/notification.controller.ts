import { Request, Response } from 'express';
import prisma from '../../config/db';

export const getNotificationsController = async (req: Request, res: Response) => {
  try {
    if (!(req as any).user || !(req as any).user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }
    const userId = (req as any).user.id;
    const notifications = await prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
};

export const markNotificationReadController = async (req: Request, res: Response) => {
  try {
    if (!(req as any).user || !(req as any).user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }
    const { notificationId } = req.params;
    const userId = (req as any).user.id;
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
};

export const markAllNotificationsReadController = async (req: Request, res: Response) => {
  try {
    if (!(req as any).user || !(req as any).user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }
    const userId = (req as any).user.id;
    await prisma.notification.updateMany({
      where: { 
        recipientId: userId,
        isRead: false 
      },
      data: { isRead: true },
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read.' });
  }
};
