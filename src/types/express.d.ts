
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'STUDENT' | 'ADMIN' | 'TEACHER' | 'ASSISTANT' | 'SUPER_ADMIN';
        forcePasswordChange: boolean;
      };
    }
  }
}