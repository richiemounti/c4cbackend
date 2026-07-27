"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/auth.routes.ts
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const validation_auth_middleware_1 = require("../middlewares/validation.auth.middleware");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const router = express_1.default.Router();
// Authentication routes
router.post('/sign-up', validation_auth_middleware_1.validateSignUp, auth_controller_1.signUp);
router.post('/sign-in', validation_auth_middleware_1.validateSignIn, auth_controller_1.signIn);
router.post('/sign-out', auth_controller_1.signOut);
// Get current user (protected route)
router.get('/me', auth_middleware_1.default, auth_controller_1.getCurrentUser); // Add this route
// Password reset routes
router.post('/forgot-password', validation_auth_middleware_1.validateForgotPassword, auth_controller_1.forgotPassword);
router.post('/reset-password', validation_auth_middleware_1.validateResetPassword, auth_controller_1.resetPassword);
router.get('/verify-reset-token/:token', auth_controller_1.verifyResetToken);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map