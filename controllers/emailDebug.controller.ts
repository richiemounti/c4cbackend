// controllers/emailDebug.controller.ts

import { Request, Response, NextFunction } from 'express';
import emailService from '../services/email.service';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Debug email configuration
 * @route GET /api/v1/debug/email
 */
export const debugEmailConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = emailService.getStatus();
    
    res.status(200).json({
      success: true,
      data: {
        emailService: status,
        environment: {
          GMAIL_USER: env.GMAIL_USER ? 'Set' : 'Not set',
          GMAIL_APP_PASSWORD: env.GMAIL_APP_PASSWORD ? `Set (${env.GMAIL_APP_PASSWORD.length} chars)` : 'Not set',
          EMAIL_FROM: env.EMAIL_FROM ? 'Set' : 'Not set',
          EMAIL_FROM_NAME: env.EMAIL_FROM_NAME || 'Not set',
          EMAIL_NOTIFICATIONS_ENABLED: env.EMAIL_NOTIFICATIONS_ENABLED
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Test Gmail connection manually
 * @route POST /api/v1/debug/email/test-connection
 */
export const testGmailConnection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('🧪 Manual Gmail connection test started...');
    
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
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
      const transporter587 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        connectionTimeout: 5000,
      });

      await transporter587.verify();
      testResults.push({ port: 587, status: 'success' });
      console.log('✅ Port 587: Success');
    } catch (error: any) {
      testResults.push({ port: 587, status: 'failed', error: error.message || 'Unknown error' });
      console.log('❌ Port 587: Failed -', error.message || 'Unknown error');
    }

    // Test 2: Port 465
    try {
      console.log('Testing port 465...');
      const transporter465 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        connectionTimeout: 5000,
      });

      await transporter465.verify();
      testResults.push({ port: 465, status: 'success' });
      console.log('✅ Port 465: Success');
    } catch (error: any) {
      testResults.push({ port: 465, status: 'failed', error: error.message || 'Unknown error' });
      console.log('❌ Port 465: Failed -', error.message || 'Unknown error');
    }

    // Test 3: Service config
    try {
      console.log('Testing service config...');
      const transporterService = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        connectionTimeout: 5000,
      });

      await transporterService.verify();
      testResults.push({ port: 'service', status: 'success' });
      console.log('✅ Service config: Success');
    } catch (error: any) {
      testResults.push({ port: 'service', status: 'failed', error: error.message || 'Unknown error' });
      console.log('❌ Service config: Failed -', error.message || 'Unknown error');
    }

    res.status(200).json({
      success: true,
      message: 'Gmail connection tests completed',
      data: testResults
    });

  } catch (error) {
    console.error('❌ Manual test failed:', error);
    next(error);
  }
};

/**
 * Send test email
 * @route POST /api/v1/debug/email/send-test
 */
export const sendTestEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
      return;
    }

    const success = await emailService.sendTestEmail(email);

    res.status(200).json({
      success,
      message: success ? 'Test email sent successfully' : 'Failed to send test email',
      data: { email, sent: success }
    });
  } catch (error) {
    next(error);
  }
};

