// config/env.ts - Updated with OAuth config, Gmail, and Cloudinary
import { config } from "dotenv";
import { resolve } from 'path';
import * as fs from 'fs';

// List of possible env file locations in order of preference
const envPaths = [
  resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}.local`),
  resolve(__dirname, `../.env.${process.env.NODE_ENV || 'development'}`),
  resolve(__dirname, '../.env')
];

// Try to load from the first existing file
for (const path of envPaths) {
  if (fs.existsSync(path)) {
    console.log(`Loading environment from ${path}`);
    config({ path });
    break;
  }
}

// Add direct console logging for debugging
console.log('Environment variables detected:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
console.log(`PORT: ${process.env.PORT}`);

// Define interface for environment variables
interface Environment {
    NODE_ENV: string;
    PORT: number;
    DB_URI: string;
    JWT_SECRET?: string;
    JWT_EXPIRES_IN?: string | number;
    ARCJET_KEY: string;
    ARCJET_ENV?: string;
    API_BASE_URL: string;
    
    // OAuth configuration
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    MICROSOFT_CLIENT_ID: string;
    MICROSOFT_CLIENT_SECRET: string;

    // ✅ ADD: Stream Chat configuration
    STREAM_API_KEY?: string;
    STREAM_API_SECRET?: string;

    // Bug Report (existing)
    BUG_REPORT_NOTIFICATION_EMAILS: string;
    
    // Email configuration (updated for Gmail)
    EMAIL_HOST: string;
    EMAIL_PORT: string;
    EMAIL_SECURE: string;
    EMAIL_USER: string;
    EMAIL_PASSWORD: string;
    EMAIL_FROM: string;
    
    // Gmail-specific configuration
    GMAIL_USER: string;
    GMAIL_APP_PASSWORD: string;
    EMAIL_FROM_NAME: string;
    EMAIL_SERVICE: string;
    SMTP_HOST: string;
    SMTP_PORT: string;
    EMAIL_NOTIFICATIONS_ENABLED: boolean;
    EMAIL_DEBUG: boolean;

    // File storage
    FILE_STORAGE_TYPE: string;
    AWS_REGION?: string;
    AWS_S3_BUCKET?: string;
    FRONTEND_URL?: string;
    ALLOWED_ORIGINS?: string;

    //GCS Storage
    GCS_BUCKET_NAME?: string;
    GOOGLE_APPLICATION_CREDENTIALS?: string;

    // Cloudinary Storage (NEW)
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
    STORAGE_PROVIDER?: string; // 'cloudinary' | 'gcs' | 's3'

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS?: string | number;
    RATE_LIMIT_MAX_REQUESTS?: string | number;

    // Password Reset Configuration
    RESET_PASSWORD_TOKEN_EXPIRES_IN?: string | number;
    RESET_PASSWORD_TOKEN_LENGTH?: string | number;
}

// Create and export environment object with types
export const env: Environment = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
    DB_URI: process.env.DB_URI || '',
    JWT_SECRET: process.env.JWT_SECRET as string || 'your_fallback_secret',
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
export function validateEnv(): void {
    if (process.env.NODE_ENV === 'production') {
        // In production, check critical variables
        const productionRequired = ['DB_URI', 'JWT_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
        
        // Add Cloudinary to required vars if it's the storage provider
        if (env.STORAGE_PROVIDER === 'cloudinary') {
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
    const requiredEnvVars: Array<keyof Environment> = [
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
    
    const missingEnvVars = requiredEnvVars.filter(
        (envVar) => !env[envVar]
    );
    
    if (missingEnvVars.length > 0) {
        console.warn(`Missing environment variables: ${missingEnvVars.join(', ')}`);
        // Don't throw error in development, just warn
        if (process.env.NODE_ENV !== 'development') {
            throw new Error(
                `Missing required environment variables: ${missingEnvVars.join(', ')}`
            );
        }
    }
}

// Validation for Gmail-specific variables with helpful messages
export function validateGmailConfig(): void {
    const gmailVars = ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
    const missingGmail = gmailVars.filter(varName => !env[varName as keyof Environment]);
    
    if (missingGmail.length > 0) {
        console.warn(`⚠️  Gmail configuration incomplete: Missing ${missingGmail.join(', ')}`);
        console.warn('   Email notifications will not work until Gmail is properly configured.');
        console.warn('   Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file');
        
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Gmail configuration required in production: ${missingGmail.join(', ')}`);
        }
    } else {
        console.log('✅ Gmail configuration detected and ready');
    }
}

// Validation for Cloudinary configuration with helpful messages (NEW)
export function validateCloudinaryConfig(): void {
    const storageProvider = env.STORAGE_PROVIDER || 'cloudinary';
    
    // Only validate if Cloudinary is the chosen provider
    if (storageProvider !== 'cloudinary') {
        console.log(`ℹ️  Storage provider set to: ${storageProvider}`);
        return;
    }
    
    const cloudinaryVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missingCloudinary = cloudinaryVars.filter(varName => !env[varName as keyof Environment]);
    
    if (missingCloudinary.length > 0) {
        console.warn(`⚠️  Cloudinary configuration incomplete: Missing ${missingCloudinary.join(', ')}`);
        console.warn('   File uploads will not work until Cloudinary is properly configured.');
        console.warn('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
        console.warn('   Sign up at: https://cloudinary.com/users/register/free');
        
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Cloudinary configuration required in production: ${missingCloudinary.join(', ')}`);
        }
    } else {
        console.log('✅ Cloudinary configuration detected and ready');
        console.log(`   Cloud Name: ${env.CLOUDINARY_CLOUD_NAME}`);
        console.log(`   API Key: ${env.CLOUDINARY_API_KEY?.substring(0, 6)}...`);
    }
}


// ✅ ADD: Validation for Stream Chat configuration
export function validateStreamChatConfig(): void {
    const streamChatVars = ['STREAM_API_KEY', 'STREAM_API_SECRET'];
    const missingStreamChat = streamChatVars.filter(varName => !env[varName as keyof Environment]);
    
    if (missingStreamChat.length > 0) {
        console.warn(`⚠️  Stream Chat configuration incomplete: Missing ${missingStreamChat.join(', ')}`);
        console.warn('   Chat features will be disabled until Stream Chat is properly configured.');
        console.warn('   Set STREAM_API_KEY and STREAM_API_SECRET in your .env file');
        console.warn('   Sign up at: https://getstream.io/');
        
        if (process.env.NODE_ENV === 'production') {
            throw new Error(`Stream Chat configuration required in production: ${missingStreamChat.join(', ')}`);
        }
    } else {
        console.log('✅ Stream Chat configuration detected and ready');
        console.log(`   API Key: ${env.STREAM_API_KEY?.substring(0, 6)}...`);
    }
}


// Export a combined validation function that checks all services
export function validateAllConfigs(): void {
    validateEnv();
    validateGmailConfig();
    validateCloudinaryConfig();
    validateStreamChatConfig();
}