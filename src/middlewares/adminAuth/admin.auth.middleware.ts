import { Request, Response, NextFunction } from 'express';
import { Role } from '../../generated/prisma';

interface CustomRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
    forcePasswordChange: boolean;
  };
}

export const isAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Admin or Super Admin access required.' });
};

export const isSuperAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user?.role === Role.SUPER_ADMIN) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Super Admin access required.' });
};

export const isTeacher = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === Role.TEACHER || req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Teacher, Admin, or Super Admin access required.' });
};

export const isAssistant = (req: CustomRequest, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === Role.ASSISTANT || req.user.role === Role.TEACHER || req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN)) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden: Assistant, Teacher, Admin, or Super Admin access required.' });
};

export const isStudent = (req: CustomRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === Role.STUDENT) {
        return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden: Student access required.' });
};


