import { Request, Response } from 'express';
import { registerUserService, loginUserService, verifyEmailService } from '../services/auth.service';
import { PrismaClient } from 'generated/prisma';
import { sendLoginNotificationEmail } from 'services/email.service';


const prisma = new PrismaClient();
const MAX_SESSIONS = 4;

export const registerController = async (req: Request, res: Response) => {
  try {
    const newUser = await registerUserService(req.body, req.file);
    
    const { password, verificationToken, verificationTokenExpiresAt, ...userResponse } = newUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      user: userResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Something went wrong during registration.',
    });
  }
};

export const loginController = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const { user, token } = await loginUserService(email, password);
        const { password: userPassword, ...userResponse } = user;
        const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const activeSessionsCount = await prisma.session.count({
            where: {
                userId: user.id,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });
        if (activeSessionsCount >= MAX_SESSIONS) {
            return res.status(403).json({
                success: false,
                message: 'You have reached the maximum number of active sessions.',
            });
        }
        const newSession = await prisma.session.create({
            data: {
                userId: user.id,
                token: token,
                ipAddress: String(userIp),
                userAgent: req.headers['user-agent'],
                expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            },
        });
        const loginDetails = {
            ipAddress: String(userIp),
            loginTime: new Date(Date.now()),
        };
        sendLoginNotificationEmail(user.email, user.name || 'User', loginDetails);
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: new Date(Date.now() + 60 * 60 * 1000),
            path: '/',
        });
        res.status(200).json({
            success: true,
            message: 'Logged in successfully.',
            user: userResponse,
            token,
            session: {
                id: newSession.id,
                expiresAt: newSession.expiresAt,
            },
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error instanceof Error ? error.message : 'Invalid credentials.',
        });
    }
};

export const verifyEmailController = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing verification token.',
      });
    }

    const message = await verifyEmailService(token);

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Verification failed.',
    });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(200).json({ success: true, message: 'Already logged out.' });
    }

    await prisma.session.deleteMany({
      where: {
        token: token,
      },
    });

    res.clearCookie('auth_token');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to log out.',
    });
  }
};

export const verifyController = (req: Request, res: Response) => {
  
  const user = (req as any).user;
  
  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
};

export const getMaintenanceStatus = async (req: Request, res: Response) => {
  try {
    const maintenanceSetting = await prisma.systemSetting.findUnique({
      where: { key: 'isMaintenanceMode' },
    });
    const isMaintenanceMode = maintenanceSetting?.value === 'true';
    res.status(200).json({ isMaintenanceMode });
  } catch (error) {
    res.status(500).json({ isMaintenanceMode: false, message: 'Failed to retrieve status.' });
  }
};