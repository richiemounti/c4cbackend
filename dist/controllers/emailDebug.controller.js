"use strict";
// controllers/emailDebug.controller.ts
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
exports.sendTestEmail = exports.testGmailConnection = exports.debugEmailConfig = void 0;
const email_service_1 = __importDefault(require("../services/email.service"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
/**
 * Debug email configuration
 * @route GET /api/v1/debug/email
 */
const debugEmailConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const status = email_service_1.default.getStatus();
        res.status(200).json({
            success: true,
            data: {
                emailService: status,
                environment: {
                    GMAIL_USER: env_1.env.GMAIL_USER ? 'Set' : 'Not set',
                    GMAIL_APP_PASSWORD: env_1.env.GMAIL_APP_PASSWORD ? `Set (${env_1.env.GMAIL_APP_PASSWORD.length} chars)` : 'Not set',
                    EMAIL_FROM: env_1.env.EMAIL_FROM ? 'Set' : 'Not set',
                    EMAIL_FROM_NAME: env_1.env.EMAIL_FROM_NAME || 'Not set',
                    EMAIL_NOTIFICATIONS_ENABLED: env_1.env.EMAIL_NOTIFICATIONS_ENABLED
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.debugEmailConfig = debugEmailConfig;
/**
 * Test Gmail connection manually
 * @route POST /api/v1/debug/email/test-connection
 */
const testGmailConnection = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🧪 Manual Gmail connection test started...');
        if (!env_1.env.GMAIL_USER || !env_1.env.GMAIL_APP_PASSWORD) {
            res.status(400).json({
                success: false,
                message: 'Gmail credentials not configured'
            });
            return;
        }
        // Test different configurations
        const testResults = [];
        // Test 1: Port 587
        try {
            console.log('Testing port 587...');
            const transporter587 = nodemailer_1.default.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: env_1.env.GMAIL_USER,
                    pass: env_1.env.GMAIL_APP_PASSWORD,
                },
                connectionTimeout: 5000,
            });
            yield transporter587.verify();
            testResults.push({ port: 587, status: 'success' });
            console.log('✅ Port 587: Success');
        }
        catch (error) {
            testResults.push({ port: 587, status: 'failed', error: error.message || 'Unknown error' });
            console.log('❌ Port 587: Failed -', error.message || 'Unknown error');
        }
        // Test 2: Port 465
        try {
            console.log('Testing port 465...');
            const transporter465 = nodemailer_1.default.createTransport({
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                auth: {
                    user: env_1.env.GMAIL_USER,
                    pass: env_1.env.GMAIL_APP_PASSWORD,
                },
                connectionTimeout: 5000,
            });
            yield transporter465.verify();
            testResults.push({ port: 465, status: 'success' });
            console.log('✅ Port 465: Success');
        }
        catch (error) {
            testResults.push({ port: 465, status: 'failed', error: error.message || 'Unknown error' });
            console.log('❌ Port 465: Failed -', error.message || 'Unknown error');
        }
        // Test 3: Service config
        try {
            console.log('Testing service config...');
            const transporterService = nodemailer_1.default.createTransport({
                service: 'gmail',
                auth: {
                    user: env_1.env.GMAIL_USER,
                    pass: env_1.env.GMAIL_APP_PASSWORD,
                },
                connectionTimeout: 5000,
            });
            yield transporterService.verify();
            testResults.push({ port: 'service', status: 'success' });
            console.log('✅ Service config: Success');
        }
        catch (error) {
            testResults.push({ port: 'service', status: 'failed', error: error.message || 'Unknown error' });
            console.log('❌ Service config: Failed -', error.message || 'Unknown error');
        }
        res.status(200).json({
            success: true,
            message: 'Gmail connection tests completed',
            data: testResults
        });
    }
    catch (error) {
        console.error('❌ Manual test failed:', error);
        next(error);
    }
});
exports.testGmailConnection = testGmailConnection;
/**
 * Send test email
 * @route POST /api/v1/debug/email/send-test
 */
const sendTestEmail = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({
                success: false,
                message: 'Email address is required'
            });
            return;
        }
        const success = yield email_service_1.default.sendTestEmail(email);
        res.status(200).json({
            success,
            message: success ? 'Test email sent successfully' : 'Failed to send test email',
            data: { email, sent: success }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.sendTestEmail = sendTestEmail;
//# sourceMappingURL=emailDebug.controller.js.map