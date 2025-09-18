import { Request, Response } from 'express';
import prisma from '../config/db';
import { Role,SystemSetting} from '../generated/prisma';
import { NotificationService } from '../services/notification.service';
import { sendMaintenanceModeEmail, sendWhitelistUpdateEmail } from 'services/email.service';


export const promoteUserController = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        const user = (req as any).user;
        
        if (!role || !Object.values(Role).includes(role)) {
            return res.status(400).json({ success: false, message: 'A valid role is required.' });
        }
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true }
        });
        if (!currentUser) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        if (currentUser.role === role) {
            return res.status(400).json({ 
                success: false, 
                message: `User already has the role ${role}.` 
            });
        }

        const oldRole = currentUser.role;
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role: role as Role },
            select: { id: true, name: true, email: true, role: true },
        });
        await NotificationService.notifyRoleUpdate(
            userId,
            oldRole,
            role,
            user.name || 'Super Administrator',
            {
                updatedById: user.id,
                updateDate: new Date().toISOString(),
                additionalPermissions: [`Promoted from ${oldRole} to ${role} by Super Administrator`]
            }
        );

        res.status(200).json({ 
            success: true, 
            message: `User successfully promoted from ${oldRole} to ${role}. User has been notified.`, 
            user: updatedUser 
        });
    } catch (error) {
        console.error('Error promoting user:', error);
        res.status(500).json({ success: false, message: 'Failed to promote user.' });
    }
};

export const setSystemSettingsController = async (req: Request, res: Response) => {
  try {
    const settings: { [key: string]: string } = req.body;

    const updateTransactions = Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
    await prisma.$transaction(updateTransactions);
    res.status(200).json({
      success: true,
      message: 'System settings updated successfully.',
      settings,
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update systesm settings.' });
  }
};

export const getSystemSettingsController = async (req: Request, res: Response) => {
  try {
    const settingsFromDb = await prisma.systemSetting.findMany();
    const settings = settingsFromDb.reduce((acc: Record<string, string>, setting: SystemSetting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as { [key: string]: string });

    res.status(200).json({
      success: true,
      message: 'System settings retrieved successfully.',
      settings,
    });
  } catch (error) {
    console.error('Error retrieving system settings:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve system settings.' });
  }
};

export const getUsersController = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: 'desc' }
    });
    
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

export const getAllExamScores = async (req: Request, res: Response) => {
  try {
    const scores = await prisma.examAttempt.findMany({
      select: {
        id: true,
        examId: true,
        userId: true,
        score: true,
        isPassed: true,
        completedAt: true,
        videoRecordingKey: true, 
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                isActive: true,
                isPublished: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            collegese_lms_id: true,
            year: true,
            department: true,
          },
        },
      },
      orderBy: { completedAt: "desc" },
    });

    if (!scores.length) {
      return res.status(404).json({ message: "No exam scores found" });
    }

    res.json({ total: scores.length, scores });
  } catch (error: any) {
    console.error("Error fetching all exam scores:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const toggleMaintenanceMode = async (req: Request, res: Response) => {
    try {
        const { isMaintenanceMode, reason } = req.body;
        if (typeof isMaintenanceMode !== 'boolean') {
            return res.status(400).json({ message: 'Invalid value for maintenance mode.' });
        }
        const updatedSetting = await prisma.systemSetting.upsert({
            where: { key: 'isMaintenanceMode' },
            update: { value: String(isMaintenanceMode) },
            create: { key: 'isMaintenanceMode', value: String(isMaintenanceMode) },
        });
        const usersToNotify = await prisma.user.findMany({
            where: {
                OR: [
                    { role: 'ADMIN' },
                    { role: 'SUPER_ADMIN' },
                    { role: 'TEACHER' },
                    { role: 'STUDENT' },
                ],
            },
            select: {
                email: true,
                name: true,
                role: true, 
            },
        });
        const emailPromises = usersToNotify.map(user => {
            if (user.email) {
                return sendMaintenanceModeEmail(
                    user.email,
                    user.name || 'User',
                    user.role, 
                    isMaintenanceMode,
                    reason || 'No reason provided.'
                );
            }
            return Promise.resolve();
        });
        await Promise.all(emailPromises);
        res.status(200).json({
            success: true,
            message: `Maintenance mode is now ${isMaintenanceMode ? 'enabled' : 'disabled'}.`,
            setting: updatedSetting,
        });
    } catch (error) {
        console.error('Toggle maintenance error:', error);
        res.status(500).json({ message: 'Failed to update maintenance mode.' });
    }
};

export const updateMaintenanceWhitelist = async (req: Request, res: Response) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds)) {
            return res.status(400).json({
                message: "Invalid value for whitelist. Must be an array of user IDs."
            });
        }
        const updatedSetting = await prisma.systemSetting.upsert({
            where: { key: "maintenanceAllowedUsers" },
            update: { value: JSON.stringify(userIds) },
            create: { key: "maintenanceAllowedUsers", value: JSON.stringify(userIds) },
        });
        const whitelistedUsers = await prisma.user.findMany({
            where: {
                id: {
                    in: userIds,
                },
            },
            select: {
                name: true,
            },
        });
        const whitelistUserNames = whitelistedUsers.map(user => user.name);
        const adminUsers = await prisma.user.findMany({
            where: {
                role: 'ADMIN',
            },
            select: {
                email: true,
                name: true,
            },
        });
        const emailPromises = adminUsers.map(admin => {
            if (admin.email) {
                return sendWhitelistUpdateEmail(admin.email, admin.name || 'Administrator', whitelistUserNames);
            }
            return Promise.resolve();
        });
        await Promise.all(emailPromises);
        res.status(200).json({
            success: true,
            message: "Whitelist updated successfully.",
            setting: updatedSetting,
        });
    } catch (error) {
        console.error('Update whitelist error:', error);
        res.status(500).json({ message: "Failed to update whitelist." });
    }
};
