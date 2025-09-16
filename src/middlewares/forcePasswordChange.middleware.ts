import { Request, Response, NextFunction } from 'express';

export const forcePasswordChangeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.user && req.user.forcePasswordChange) {
        return res.status(403).json({ 
            message: 'Password change required.', 
            forcePasswordChange: true 
        });
    }
    next();
};