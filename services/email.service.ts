// services/email.service.ts - IMPROVED VERSION with Better Logging

import nodemailer from 'nodemailer';
import { env } from '../config/env';

// Email template interface
interface EmailTemplate {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

// Email result interface for better tracking
interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private emailsSent: number = 0;
  private emailsFailed: number = 0;

  constructor() {
    this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      console.log('🔧 Initializing email service...');
      console.log('📧 Gmail User:', env.GMAIL_USER || 'Not set');
      console.log('🔑 App Password:', env.GMAIL_APP_PASSWORD ? `Present (${env.GMAIL_APP_PASSWORD.length} chars)` : 'Not set');

      if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
        console.warn('⚠️  Gmail credentials not configured. Email notifications will not work.');
        return;
      }

      // Configuration 1: Try port 587 with STARTTLS (recommended)
      console.log('🔍 Trying Gmail SMTP on port 587...');
      const config587 = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000,     // 10 seconds
      };

      try {
        this.transporter = nodemailer.createTransport(config587);
        await this.testConnection();
        this.isConfigured = true;
        console.log('✅ Gmail SMTP configured successfully on port 587');
        return;
      } catch (error) {
        console.log('❌ Port 587 failed, trying port 465...');
      }

      // Configuration 2: Try port 465 with SSL
      console.log('🔍 Trying Gmail SMTP on port 465...');
      const config465 = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
      };

      try {
        this.transporter = nodemailer.createTransport(config465);
        await this.testConnection();
        this.isConfigured = true;
        console.log('✅ Gmail SMTP configured successfully on port 465');
        return;
      } catch (error) {
        console.log('❌ Port 465 failed, trying service config...');
      }

      // Configuration 3: Use nodemailer's built-in Gmail service
      console.log('🔍 Trying Gmail service configuration...');
      const serviceConfig = {
        service: 'gmail',
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      try {
        this.transporter = nodemailer.createTransport(serviceConfig);
        await this.testConnection();
        this.isConfigured = true;
        console.log('✅ Gmail service configured successfully');
        return;
      } catch (error) {
        console.log('❌ Gmail service config failed');
      }

      // All configurations failed
      console.error('❌ All Gmail configurations failed');
      this.logTroubleshootingInfo();

    } catch (error) {
      console.error('❌ Email service initialization error:', error);
      this.logTroubleshootingInfo();
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('No transporter configured');
    }

    // Create a promise that times out after 10 seconds
    const testPromise = this.transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
    );

    await Promise.race([testPromise, timeoutPromise]);
  }

  private logTroubleshootingInfo(): void {
    console.error('📋 Troubleshooting Gmail SMTP:');
    console.error('   1. Verify 2-Factor Authentication is enabled on your Gmail account');
    console.error('   2. Generate a new App Password:');
    console.error('      - Go to Google Account → Security → 2-Step Verification → App passwords');
    console.error('      - Choose "Mail" and "Other (Youth Impact Platform)"');
    console.error('      - Copy the 16-character password exactly (no spaces)');
    console.error('   3. Check your environment variables:');
    console.error('      - GMAIL_USER should be your full Gmail address');
    console.error('      - GMAIL_APP_PASSWORD should be 16 lowercase letters');
    console.error('   4. Network issues:');
    console.error('      - Check if your firewall blocks SMTP ports (587, 465)');
    console.error('      - Try from a different network');
    console.error('      - Disable VPN if using one');
    
    if (env.GMAIL_APP_PASSWORD) {
      const appPassword = env.GMAIL_APP_PASSWORD;
      if (appPassword.length !== 16) {
        console.error('   ⚠️  App password length is', appPassword.length, 'but should be 16');
      }
      if (!/^[a-z]+$/.test(appPassword)) {
        console.error('   ⚠️  App password contains invalid characters (should only be lowercase letters)');
      }
    }
  }

  // ✅ IMPROVED: Enhanced email sending with better logging and tracking
  async sendEmail(emailData: EmailTemplate): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Check if notifications are enabled
      if (!env.EMAIL_NOTIFICATIONS_ENABLED) {
        console.log('📧 Email notifications disabled in environment');
        return false;
      }

      // Check if service is configured
      if (!this.isConfigured || !this.transporter) {
        console.warn('⚠️  Gmail not configured. Cannot send email.');
        console.warn('   To:', emailData.to);
        console.warn('   Subject:', emailData.subject);
        return false;
      }

      // Prepare mail options
      const mailOptions = {
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        cc: emailData.cc,
        bcc: emailData.bcc,
        attachments: emailData.attachments,
      };

      // Log sending attempt
      console.log('📧 Sending email:', {
        to: emailData.to,
        subject: emailData.subject,
        from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
        timestamp: new Date().toISOString()
      });

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      const duration = Date.now() - startTime;
      
      // ✅ SUCCESS - Enhanced logging
      this.emailsSent++;
      console.log('✅ Email sent successfully:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        to: emailData.to,
        subject: emailData.subject,
        duration: `${duration}ms`,
        totalSent: this.emailsSent,
        timestamp: new Date().toISOString()
      });
      
      return true;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // ❌ FAILURE - Enhanced error logging
      this.emailsFailed++;
      console.error('❌ Email send failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        to: emailData.to,
        subject: emailData.subject,
        duration: `${duration}ms`,
        totalFailed: this.emailsFailed,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }

  // ✅ NEW: Send email with retry logic
  async sendEmailWithRetry(
    emailData: EmailTemplate, 
    maxRetries: number = 3,
    delayMs: number = 2000
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📧 Attempt ${attempt}/${maxRetries} to send email...`);
        const result = await this.sendEmail(emailData);
        
        if (result) {
          if (attempt > 1) {
            console.log(`✅ Email sent successfully on attempt ${attempt}/${maxRetries}`);
          }
          return true;
        }
        
        // If sendEmail returned false (not an error), don't retry
        console.warn(`⚠️  Email send returned false, not retrying`);
        return false;
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`❌ All ${maxRetries} attempts failed`);
          return false;
        }
      }
    }
    return false;
  }

  // Test email function
  async sendTestEmail(to: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Youth Impact Platform - Email Test</h2>
        <p>Hello,</p>
        <p>This is a test email to verify that the Youth Impact Platform email notifications are working correctly.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>✅ Email service is configured correctly</strong></p>
          <p><strong>✅ Gmail SMTP connection is working</strong></p>
          <p><strong>✅ Notifications are ready to be sent</strong></p>
        </div>
        <div style="background-color: #1f2937; color: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Configuration Details:</strong></p>
          <p>From: ${env.EMAIL_FROM_NAME} &lt;${env.EMAIL_FROM}&gt;</p>
          <p>Service: Gmail SMTP</p>
          <p>Frontend URL: ${env.FRONTEND_URL}</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        </div>
        <p style="font-size: 12px; color: #757575; margin-top: 30px;">
          This email was sent from ${env.FRONTEND_URL}
        </p>
        <p>Best regards,<br>Youth Impact Platform Team</p>
      </div>
    `;

    return this.sendEmail({
      to,
      subject: 'Youth Impact Platform - Email Test Success!',
      html,
    });
  }

  // ✅ NEW: Get service statistics
  getStats(): {
    configured: boolean;
    ready: boolean;
    emailsSent: number;
    emailsFailed: number;
    successRate: string;
  } {
    const total = this.emailsSent + this.emailsFailed;
    const successRate = total > 0 
      ? `${((this.emailsSent / total) * 100).toFixed(1)}%` 
      : 'N/A';

    return {
      configured: this.isConfigured,
      ready: !!this.transporter,
      emailsSent: this.emailsSent,
      emailsFailed: this.emailsFailed,
      successRate
    };
  }

  // Check if email service is ready
  isReady(): boolean {
    return this.isConfigured && !!this.transporter;
  }

  // Get status for debugging
  getStatus(): { 
    configured: boolean; 
    ready: boolean; 
    credentials: boolean;
    frontendUrl: string;
  } {
    return {
      configured: this.isConfigured,
      ready: !!this.transporter,
      credentials: !!(env.GMAIL_USER && env.GMAIL_APP_PASSWORD),
      frontendUrl: env.FRONTEND_URL || 'NOT SET'
    };
  }

  // ✅ NEW: Reset statistics (useful for testing)
  resetStats(): void {
    this.emailsSent = 0;
    this.emailsFailed = 0;
    console.log('📊 Email statistics reset');
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;