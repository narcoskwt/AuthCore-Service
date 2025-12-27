import { Router } from 'express';
import validate from '../../middleware/validate';
import { loginSchema, signupSchema } from '../../validations/auth.validation';
import * as authController from '../../controller/auth.controller';
import authLimiter from '../../middleware/authLimiter';

const authRouter = Router();

authRouter.post('/signup', validate(signupSchema), authController.handleSignUp);

// Security: Rate limiting applied only to login and refresh endpoints
authRouter.post('/login', authLimiter, validate(loginSchema), authController.handleLogin);

authRouter.post('/logout', authController.handleLogout);

authRouter.post('/refresh', authLimiter, authController.handleRefresh);

export default authRouter;
