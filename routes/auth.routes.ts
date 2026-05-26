// routes/auth.routes.ts
import express from 'express';
import { 
  signUp, 
  signIn, 
  signOut, 
  forgotPassword, 
  resetPassword, 
  verifyResetToken, 
  getCurrentUser
} from '../controllers/auth.controller';
import { validateSignUp, validateSignIn, validateForgotPassword, validateResetPassword } from '../middlewares/validation.auth.middleware';
import authorize from '../middlewares/auth.middleware';

const router = express.Router();

// Authentication routes
router.post('/sign-up', validateSignUp, signUp);
router.post('/sign-in', validateSignIn, signIn);
router.post('/sign-out', signOut);

// Get current user (protected route)
router.get('/me', authorize, getCurrentUser); // Add this route

// Password reset routes
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

export default router;