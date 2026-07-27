"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.verifyResetToken = exports.resetPassword = exports.forgotPassword = exports.signOut = exports.signIn = exports.signUp = void 0;
// controllers/auth.controller.ts
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importDefault(require("../models/user.model"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const email_service_1 = require("../services/email.service");
const emailTemplates_service_1 = __importDefault(require("../services/emailTemplates.service"));
// Use type assertion to help TypeScript understand this is a string
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
const signUp = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Logic to create a new user
        const { userName, name, email, password, role, organizationId } = req.body;
        // Check if a user already exists
        const existingUser = yield user_model_1.default.findOne({ email });
        if (existingUser) {
            const error = new Error('User already exists');
            error.statusCode = 409;
            throw error;
        }
        // Hash password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        // Create user data object
        const userData = {
            userName,
            name,
            email,
            password: hashedPassword
        };
        // Handle role assignment
        const connectGoRoles = ['owner', 'admin', 'accountManager'];
        const clientRoles = ['manager', 'projectCreator', 'organiser', 'reviewer', 'fieldAgent'];
        // Roles that require organization (except manager)
        const rolesRequiringOrg = ['projectCreator', 'organiser', 'reviewer', 'fieldAgent'];
        // Default role
        let userRole = 'manager';
        let isConnectGoStaff = false;
        // If role is specified
        if (role) {
            // Validate role
            if ([...connectGoRoles, ...clientRoles].includes(role)) {
                userRole = role;
                // Check if it's a ConnectGo role
                if (connectGoRoles.includes(role)) {
                    isConnectGoStaff = true;
                }
            }
            else {
                const error = new Error('Invalid role specified');
                error.statusCode = 400;
                throw error;
            }
        }
        // Set primary role
        userData.primaryRole = userRole;
        userData.isConnectGoStaff = isConnectGoStaff;
        // Create roles array
        userData.roles = [];
        // For ConnectGo roles, we just need the role name
        if (connectGoRoles.includes(userRole)) {
            userData.roles.push({ role: userRole });
        }
        // For manager role, organization is optional
        else if (userRole === 'manager') {
            const roleData = { role: userRole };
            // Add organization if provided
            if (organizationId) {
                roleData.organization = organizationId;
            }
            userData.roles.push(roleData);
        }
        // For other client roles, we need organization
        else if (clientRoles.includes(userRole)) {
            // Organization is required for client roles (except manager)
            if (rolesRequiringOrg.includes(userRole) && !organizationId) {
                const error = new Error('Organization ID is required for this role');
                error.statusCode = 400;
                throw error;
            }
            userData.roles.push({
                role: userRole,
                organization: organizationId
            });
        }
        const newUsers = yield user_model_1.default.create([userData], { session });
        // Create the token directly without defining the options separately
        const token = jsonwebtoken_1.default.sign({ userId: newUsers[0]._id.toString() }, JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                token,
                user: {
                    _id: newUsers[0]._id,
                    userName: newUsers[0].userName,
                    name: newUsers[0].name,
                    email: newUsers[0].email,
                    primaryRole: newUsers[0].primaryRole,
                    roles: newUsers[0].roles,
                    isConnectGoStaff: newUsers[0].isConnectGoStaff
                }
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.signUp = signUp;
const signIn = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield user_model_1.default.findOne({ email }).select('+password').exec();
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 401;
            throw error;
        }
        const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            const error = new Error('Invalid password');
            error.statusCode = 401;
            throw error;
        }
        // ADD THIS LOGGING
        console.log('🔐 JWT Configuration:');
        console.log('JWT_EXPIRES_IN from env:', env_1.env.JWT_EXPIRES_IN);
        console.log('JWT_SECRET exists:', !!JWT_SECRET);
        // Create token
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString() }, JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN
        });
        // DECODE THE TOKEN TO VERIFY EXPIRATION
        const decoded = jsonwebtoken_1.default.decode(token);
        if (decoded && decoded.exp) {
            const expirationDate = new Date(decoded.exp * 1000);
            const now = new Date();
            const hoursUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            console.log('✅ Token created successfully');
            console.log('Token expires at:', expirationDate.toISOString());
            console.log('Hours until expiry:', hoursUntilExpiry.toFixed(2));
        }
        res.status(200).json({
            success: true,
            message: 'User Logged in successfully',
            data: {
                token,
                user: {
                    _id: user._id,
                    userName: user.userName,
                    name: user.name,
                    email: user.email,
                    primaryRole: user.primaryRole,
                    roles: user.roles,
                    isConnectGoStaff: user.isConnectGoStaff
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.signIn = signIn;
const signOut = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Since JWT is stateless, we don't need to do much server-side
        // The client will need to remove the token from storage
        // You could add token blacklisting if needed:
        // const token = req.headers.authorization?.split(' ')[1];
        // await BlacklistedToken.create({ token });
        res.status(200).json({
            success: true,
            message: 'Successfully logged out',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
exports.signOut = signOut;
/**
 * Forgot Password - Generate reset token and send email
 * @route POST /api/v1/auth/forgot-password
 * @access Public
 */
const forgotPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        // Validate email
        if (!email) {
            const error = new Error('Email is required');
            error.statusCode = 400;
            throw error;
        }
        // Find user by email
        const user = yield user_model_1.default.findOne({ email }).exec();
        if (!user) {
            // Don't reveal if user exists or not for security
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, you will receive a password reset link.',
                data: null
            });
        }
        // Generate reset token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        // Hash token before storing in database
        const hashedToken = crypto_1.default
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');
        // Set reset token and expiry (1 hour)
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        yield user.save();
        // Create reset URL
        const resetURL = `${env_1.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        // Prepare email content
        const emailSubject = 'Youth Impact Platform - Password Reset Request';
        const emailHtml = emailTemplates_service_1.default.generatePasswordResetEmail({
            userName: user.name,
            resetURL,
            userEmail: user.email
        });
        // Send email
        const emailSent = yield email_service_1.emailService.sendEmail({
            to: user.email,
            subject: emailSubject,
            html: emailHtml
        });
        if (!emailSent) {
            console.error('Failed to send password reset email to:', user.email);
            // Clear the reset token if email failed
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            yield user.save();
            const error = new Error('Failed to send reset email. Please try again later.');
            error.statusCode = 500;
            throw error;
        }
        console.log(`🔐 Password reset email sent to: ${user.email}`);
        res.status(200).json({
            success: true,
            message: 'Password reset link sent to your email address.',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
exports.forgotPassword = forgotPassword;
/**
 * Reset Password - Verify token and update password
 * @route POST /api/v1/auth/reset-password
 * @access Public
 */
const resetPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token, password } = req.body;
        // Validate inputs
        if (!token || !password) {
            const error = new Error('Token and password are required');
            error.statusCode = 400;
            throw error;
        }
        // Validate password strength
        if (password.length < 6) {
            const error = new Error('Password must be at least 6 characters long');
            error.statusCode = 400;
            throw error;
        }
        // Hash the token to compare with stored token
        const hashedToken = crypto_1.default
            .createHash('sha256')
            .update(token)
            .digest('hex');
        // Find user with matching token that hasn't expired
        const user = yield user_model_1.default.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        }).exec();
        if (!user) {
            const error = new Error('Invalid or expired password reset token');
            error.statusCode = 400;
            throw error;
        }
        // Hash the new password
        const salt = yield bcryptjs_1.default.genSalt(10);
        const hashedPassword = yield bcryptjs_1.default.hash(password, salt);
        // Update password and clear reset fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        yield user.save();
        console.log(`🔐 Password reset successfully for user: ${user.email}`);
        // Send confirmation email
        const confirmationEmailHtml = emailTemplates_service_1.default.generatePasswordChangedEmail(user.name, user.email);
        yield email_service_1.emailService.sendEmail({
            to: user.email,
            subject: 'Youth Impact Platform - Password Changed Successfully',
            html: confirmationEmailHtml
        });
        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully. You can now login with your new password.',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
exports.resetPassword = resetPassword;
/**
 * Verify Reset Token - Check if token is valid and not expired
 * @route GET /api/v1/auth/verify-reset-token/:token
 * @access Public
 */
const verifyResetToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { token } = req.params;
        if (!token) {
            const error = new Error('Token is required');
            error.statusCode = 400;
            throw error;
        }
        // Hash the token
        const hashedToken = crypto_1.default
            .createHash('sha256')
            .update(token)
            .digest('hex');
        // Find user with matching token that hasn't expired
        const user = yield user_model_1.default.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        }).exec();
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset token',
                valid: false
            });
        }
        res.status(200).json({
            success: true,
            message: 'Token is valid',
            valid: true,
            data: {
                email: user.email, // Can show email to user for verification
                expiresAt: user.resetPasswordExpires
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.verifyResetToken = verifyResetToken;
// controllers/auth.controller.ts
// ... (keep all your existing imports and code)
/**
 * Get Current User - Get authenticated user's details
 * @route GET /api/v1/auth/me
 * @access Private (requires authentication)
 */
const getCurrentUser = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // The auth middleware should have already attached the user to req.user
        // If you don't have this middleware yet, we'll need to add it
        const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) || ((_b = req.user) === null || _b === void 0 ? void 0 : _b.userId) || req.userId;
        if (!userId) {
            const error = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }
        // Find user by ID
        const user = yield user_model_1.default.findById(userId).select('-password').exec();
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: {
                user: {
                    _id: user._id,
                    userName: user.userName,
                    name: user.name,
                    email: user.email,
                    photo: user.photo,
                    primaryRole: user.primaryRole,
                    roles: user.roles,
                    isConnectGoStaff: user.isConnectGoStaff
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCurrentUser = getCurrentUser;
//# sourceMappingURL=auth.controller.js.map