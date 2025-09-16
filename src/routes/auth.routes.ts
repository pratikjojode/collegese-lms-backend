import express from 'express';
import { 
    registerController, 
    loginController, 
    verifyEmailController, 
    logoutController,
    verifyController,
    getMaintenanceStatus
} from '../controllers/auth.controller';
import { 
    forgotPasswordController,
    changePasswordController,
    resetPasswordController
} from '../controllers/password.controller';

import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadProfilePic } from 'middlewares/multer.middleware';

const authRouter = express.Router();

authRouter.post('/register', uploadProfilePic, registerController);
authRouter.post('/login', loginController);
authRouter.get('/verify-email', verifyEmailController);
authRouter.get('/status/maintenance', getMaintenanceStatus);
authRouter.post('/forgot-password', forgotPasswordController);
authRouter.post('/change-password', authMiddleware, changePasswordController);
authRouter.post('/reset-password', resetPasswordController);
authRouter.get('/verify', authMiddleware, verifyController);
authRouter.get('/reset-password', (req, res) => {
    res.status(200).send('Token is valid. You can now reset your password.');
});
authRouter.post('/logout', authMiddleware, logoutController);


export default authRouter;