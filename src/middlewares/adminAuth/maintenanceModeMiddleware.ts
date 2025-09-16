import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "generated/prisma";

const prisma = new PrismaClient();

export const maintenanceModeMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const maintenanceSetting = await prisma.systemSetting.findUnique({
      where: { key: 'isMaintenanceMode' },
    });
    const isMaintenanceMode = maintenanceSetting?.value === 'true';

    if (!isMaintenanceMode) {
      return next();
    }

    const user = (req as any).user;
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', ];

    if (user?.role && allowedRoles.includes(user.role)) {
      return next();
    }

    const whitelistSetting = await prisma.systemSetting.findUnique({
      where: { key: 'maintenanceAllowedUsers' },
    });
    
    let allowedUsers: string[] = [];
    if (whitelistSetting?.value) {
      try {
        const parsedValue = JSON.parse(whitelistSetting.value);
        if (Array.isArray(parsedValue)) {
          allowedUsers = parsedValue.filter(id => typeof id === 'string');
        }
      } catch (e) {
        console.error('Failed to parse whitelist from DB:', e);
      }
    }

    if (user?.id && allowedUsers.includes(user.id)) {
      return next();
    }

    return res.status(503).json({
      success: false,
      message: '🔧 System is under maintenance. Please try again later.',
      maintenanceMode: true,
    });

  } catch (error) {
    console.error('Maintenance middleware error:', error);
    next();
  }
};