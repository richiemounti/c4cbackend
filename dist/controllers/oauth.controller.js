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
exports.processOAuthCode = exports.microsoftCallback = exports.googleCallback = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
// JWT Secret type assertion
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
/**
 * Handle Google OAuth callback
 * @route POST /api/v1/auth/google/callback
 * @access Public
 */
const googleCallback = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            const error = new Error("Authentication failed");
            error.statusCode = 401;
            throw error;
        }
        // User is already set by passport middleware
        const user = req.user;
        // Create token
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString() }, JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN
        });
        // Get the redirect URL from the state parameter
        let redirectUrl = "http://localhost:3000/dashboard"; // Default frontend URL
        try {
            if (req.query.state) {
                // State was encoded in Base64
                const decodedState = Buffer.from(req.query.state, 'base64').toString();
                // If it's a valid URL, use it
                if (decodedState.startsWith('http')) {
                    redirectUrl = decodedState;
                }
            }
        }
        catch (error) {
            console.error("Error decoding state:", error);
        }
        // Prepare user data to include in redirect
        const userData = {
            _id: user._id,
            userName: user.userName,
            name: user.name,
            email: user.email,
            primaryRole: user.primaryRole,
            roles: user.roles,
            isConnectGoStaff: user.isConnectGoStaff
        };
        // Include token and user in the redirect URL
        const finalRedirectUrl = new URL(redirectUrl);
        finalRedirectUrl.searchParams.append('token', token);
        finalRedirectUrl.searchParams.append('userData', JSON.stringify(userData));
        // Redirect to frontend with token and user data
        return res.redirect(finalRedirectUrl.toString());
    }
    catch (error) {
        next(error);
    }
});
exports.googleCallback = googleCallback;
/**
 * Handle Microsoft OAuth callback
 * @route POST /api/v1/auth/microsoft/callback
 * @access Public
 */
const microsoftCallback = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            const error = new Error("Authentication failed");
            error.statusCode = 401;
            throw error;
        }
        // User is already set by passport middleware
        const user = req.user;
        // Create token
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString() }, JWT_SECRET, {
            expiresIn: env_1.env.JWT_EXPIRES_IN
        });
        // Get the redirect URL from the state parameter
        let redirectUrl = "http://localhost:3000/dashboard"; // Default frontend URL
        try {
            if (req.query.state) {
                // State was encoded in Base64
                const decodedState = Buffer.from(req.query.state, 'base64').toString();
                // If it's a valid URL, use it
                if (decodedState.startsWith('http')) {
                    redirectUrl = decodedState;
                }
            }
        }
        catch (error) {
            console.error("Error decoding state:", error);
        }
        // Prepare user data to include in redirect
        const userData = {
            _id: user._id,
            userName: user.userName,
            name: user.name,
            email: user.email,
            primaryRole: user.primaryRole,
            roles: user.roles,
            isConnectGoStaff: user.isConnectGoStaff
        };
        // Include token and user in the redirect URL
        const finalRedirectUrl = new URL(redirectUrl);
        finalRedirectUrl.searchParams.append('token', token);
        finalRedirectUrl.searchParams.append('userData', JSON.stringify(userData));
        // Redirect to frontend with token and user data
        return res.redirect(finalRedirectUrl.toString());
    }
    catch (error) {
        next(error);
    }
});
exports.microsoftCallback = microsoftCallback;
/**
 * Process OAuth code
 * @route POST /api/v1/auth/:provider/callback
 * @access Public
 */
const processOAuthCode = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, redirect_uri } = req.body;
        const provider = req.params.provider;
        if (!code) {
            const error = new Error("Authentication code is required");
            error.statusCode = 400;
            throw error;
        }
        // This would normally exchange the code for a token with the OAuth provider
        // For this implementation, we're assuming the passport middleware handled this
        // and the user is already authenticated
        // In a real implementation, you would:
        // 1. Exchange the code for a token with the OAuth provider
        // 2. Use the token to get user profile information
        // 3. Find or create a user based on the profile
        // 4. Generate a JWT token for the user
        // For now, we'll just return a placeholder response
        res.status(200).json({
            success: true,
            message: `${provider} authentication successful`,
            data: {
                // You would normally return a real token and user data here
                token: "sample_token",
                user: {
                    // Sample user data
                    _id: "sample_id",
                    userName: "sampleuser",
                    name: "Sample User",
                    email: "sample@example.com"
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.processOAuthCode = processOAuthCode;
//# sourceMappingURL=oauth.controller.js.map