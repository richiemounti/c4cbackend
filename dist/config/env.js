"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateEnv = validateEnv;
exports.validateGmailConfig = validateGmailConfig;
exports.validateCloudinaryConfig = validateCloudinaryConfig;
exports.validateStreamChatConfig = validateStreamChatConfig;
exports.validateAllConfigs = validateAllConfigs;
// config/env.ts - Updated with OAuth config, Gmail, and Cloudinary
const dotenv_1 = require("dotenv");
const path_1 = require("path");
const fs = __importStar(require("fs"));
// List of possible env file locations in order of preference
const envPaths = [
    (0, path_1.resolve)(__dirname, `../.env.${process.env.NODE_ENV || 'development'}.local`),
    (0, path_1.resolve)(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`),
    (0, path_1.resolve)(__dirname, '../.env')
];
// Try to load from the first existing file
for (const path of envPaths) {
    if (fs.existsSync(path)) {
        console.log(`Loading environment from ${path}`);
        (0, dotenv_1.config)({ path });
        break;
    }
}
// Add direct console logging for debugging
console.log('Environment variables detected:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
console.log(`PORT: ${process.env.PORT}`);
// Create and export environment object with types
exports.env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    DB_URI: process.env.DB_URI || '',
    JWT_SECRET: process.env.JWT_SECRET || 'your_fallback_secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
    ARCJET_KEY: process.env.ARCJET_KEY || '',
    ARCJET_ENV: process.env.ARCJET_ENV,
    // Add API base URL for callback URLs
    API_BASE_URL: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || '3000'}/api/v1`,
    // OAuth configuration
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
    // ✅ ADD: Stream Chat configuration
    STREAM_API_KEY: process.env.STREAM_API_KEY,
    STREAM_API_SECRET: process.env.STREAM_API_SECRET,
    // Stripe configuration
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    // Bug Report (existing)
    BUG_REPORT_NOTIFICATION_EMAILS: process.env.BUG_REPORT_NOTIFICATION_EMAILS || '',
    // Email configuration (existing - kept for backward compatibility)
    EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
    EMAIL_PORT: process.env.EMAIL_PORT || '587',
    EMAIL_SECURE: process.env.EMAIL_SECURE || 'false',
    EMAIL_USER: process.env.EMAIL_USER || process.env.GMAIL_USER || '',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
    EMAIL_FROM: process.env.EMAIL_FROM || process.env.GMAIL_USER || '',
    // Gmail-specific configuration
    GMAIL_USER: process.env.GMAIL_USER || '',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Youth Impact Platform',
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
    SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
    SMTP_PORT: process.env.SMTP_PORT || '587',
    EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true' || true,
    EMAIL_DEBUG: process.env.EMAIL_DEBUG === 'true' || false,
    // File storage
    FILE_STORAGE_TYPE: process.env.FILE_STORAGE_TYPE || 'cloudinary',
    AWS_REGION: process.env.AWS_REGION,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    FRONTEND_URL: process.env.FRONTEND_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    //GCS storage
    GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    // Cloudinary Storage (NEW)
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'cloudinary',
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    // Password Reset Configuration
    RESET_PASSWORD_TOKEN_EXPIRES_IN: process.env.RESET_PASSWORD_TOKEN_EXPIRES_IN,
    RESET_PASSWORD_TOKEN_LENGTH: process.env.RESET_PASSWORD_TOKEN_LENGTH
};
// Validate required environment variables
function validateEnv() {
    if (process.env.NODE_ENV === 'production') {
        // In production, check critical variables
        const productionRequired = ['DB_URI', 'JWT_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
        // Add Cloudinary to required vars if it's the storage provider
        if (exports.env.STORAGE_PROVIDER === 'cloudinary') {
            productionRequired.push('CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET');
        }
        const missingProd = productionRequired.filter(envVar => !process.env[envVar]);
        if (missingProd.length > 0) {
            console.error(`Missing critical environment variables: ${missingProd.join(', ')}`);
            throw new Error(`Critical environment variables missing: ${missingProd.join(', ')}`);
        }
        return;
    }
    // Development environment validation
    const requiredEnvVars = [
        'NODE_ENV',
        'PORT',
        'DB_URI',
        'JWT_SECRET',
        'JWT_EXPIRES_IN',
        'ARCJET_KEY',
        'API_BASE_URL',
        // OAuth variables
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'MICROSOFT_CLIENT_ID',
        'MICROSOFT_CLIENT_SECRET',
        // Email configuration (make Gmail optional in development)
        'EMAIL_HOST',
        'EMAIL_PORT',
        'EMAIL_FROM',
        // File storage
        'FILE_STORAGE_TYPE',
        'FRONTEND_URL',
        'ALLOWED_ORIGINS',
        // Rate Limiting
        'RATE_LIMIT_WINDOW_MS',
        'RATE_LIMIT_MAX_REQUESTS',
        // Password Reset Configuration
        'RESET_PASSWORD_TOKEN_EXPIRES_IN',
        'RESET_PASSWORD_TOKEN_LENGTH'
    ];
    const missingEnvVars = requiredEnvVars.filter((envVar) => !exports.env[envVar]);
    if (missingEnvVars.length > 0) {
        console.warn(`Missing environment variables: ${missingEnvVars.join(', ')}`);
        // Don't throw error in development, just warn
        if (process.env.NODE_ENV !== 'development') {
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }
    }
}
// Validation for Gmail-specific variables with helpful messages
function validateGmailConfig() {
    const gmailVars = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
    const missingGmail = gmailVars.filter(varName => !exports.env[varName]);
    if (missingGmail.length > 0) {
        console.warn(`⚠️  Gmail configuration incomplete: Missing ${missingGmail.join(', ')}`);
        console.warn('   Email notifications will not work until Gmail is properly configured.');
        console.warn('   Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Gmail configuration required in production: ${missingGmail.join(', ')}`);
        }
    }
    else {
        console.log('✅ Gmail configuration detected and ready');
    }
}
// Validation for Cloudinary configuration with helpful messages (NEW)
function validateCloudinaryConfig() {
    var _a;
    const storageProvider = exports.env.STORAGE_PROVIDER || 'cloudinary';
    // Only validate if Cloudinary is the chosen provider
    if (storageProvider !== 'cloudinary') {
        console.log(`ℹ️  Storage provider set to: ${storageProvider}`);
        return;
    }
    const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missingCloudinary = cloudinaryVars.filter(varName => !exports.env[varName]);
    if (missingCloudinary.length > 0) {
        console.warn(`⚠️  Cloudinary configuration incomplete: Missing ${missingCloudinary.join(', ')}`);
        console.warn('   File uploads will not work until Cloudinary is properly configured.');
        console.warn('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
        console.warn('   Sign up at: https://cloudinary.com/users/register/free');
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Cloudinary configuration required in production: ${missingCloudinary.join(', ')}`);
        }
    }
    else {
        console.log('✅ Cloudinary configuration detected and ready');
        console.log(`   Cloud Name: ${exports.env.CLOUDINARY_CLOUD_NAME}`);
        console.log(`   API Key: ${(_a = exports.env.CLOUDINARY_API_KEY) === null || _a === void 0 ? void 0 : _a.substring(0, 6)}...`);
    }
}
// ✅ ADD: Validation for Stream Chat configuration
function validateStreamChatConfig() {
    var _a;
    const streamChatVars = ['STREAM_API_KEY', 'STREAM_API_SECRET'];
    const missingStreamChat = streamChatVars.filter(varName => !exports.env[varName]);
    if (missingStreamChat.length > 0) {
        console.warn(`⚠️  Stream Chat configuration incomplete: Missing ${missingStreamChat.join(', ')}`);
        console.warn('   Chat features will be disabled until Stream Chat is properly configured.');
        console.warn('   Set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
        console.warn('   Sign up at: https://getstream.io/');
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Stream Chat configuration required in production: ${missingStreamChat.join(', ')}`);
        }
    }
    else {
        console.log('✅ Stream Chat configuration detected and ready');
        console.log(`   API Key: ${(_a = exports.env.STREAM_API_KEY) === null || _a === void 0 ? void 0 : _a.substring(0, 6)}...`);
    }
}
// Export a combined validation function that checks all services
function validateAllConfigs() {
    validateEnv();
    validateGmailConfig();
    validateCloudinaryConfig();
    validateStreamChatConfig();
}
//# sourceMappingURL=env.js.map