// services/emailTemplates.service.ts

export interface PasswordResetEmailData {
  userName: string;
  resetURL: string;
  userEmail: string;
}

export interface WelcomeEmailData {
  userName: string;
  userEmail: string;
  loginURL: string;
  role?: string;
  organizationName?: string;
}

export class EmailTemplateService {
  
  /**
   * Generate password reset email template
   */
  static generatePasswordResetEmail(data: PasswordResetEmailData): string {
    const { userName, resetURL, userEmail } = data;
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Citizens for Change - Password Reset</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .reset-button {
                  display: inline-block;
                  background-color: #3b82f6;
                  color: white !important;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                  transition: background-color 0.3s ease;
              }
              .reset-button:hover {
                  background-color: #2563eb;
              }
              .reset-url {
                  background-color: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  word-break: break-all;
                  color: #374151;
                  margin: 15px 0;
                  border-left: 4px solid #3b82f6;
              }
              .warning {
                  background-color: #fef3c7;
                  border: 1px solid #f59e0b;
                  border-radius: 6px;
                  padding: 15px;
                  margin: 20px 0;
              }
              .warning-title {
                  font-weight: 600;
                  color: #92400e;
                  margin-bottom: 8px;
              }
              .warning-text {
                  color: #a16207;
                  font-size: 14px;
              }
              .security-info {
                  background-color: #eff6ff;
                  border-left: 4px solid #3b82f6;
                  padding: 15px;
                  margin: 20px 0;
              }
              .security-title {
                  font-weight: 600;
                  color: #1e40af;
                  margin-bottom: 8px;
              }
              .security-text {
                  color: #1e3a8a;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .footer-links {
                  margin-top: 15px;
              }
              .footer-links a {
                  color: #3b82f6;
                  text-decoration: none;
                  margin: 0 10px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="content">
                  <div class="greeting">Hello ${userName},</div>
                  
                  <div class="message">
                      We received a request to reset the password for your Citizens for Change account associated with <strong>${userEmail}</strong>.
                  </div>
                  
                  <div class="message">
                      If you made this request, click the button below to reset your password:
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${resetURL}" class="reset-button">Reset My Password</a>
                  </div>
                  
                  <div class="message">
                      If the button doesn't work, you can copy and paste the following link into your browser:
                  </div>
                  
                  <div class="reset-url">${resetURL}</div>
                  
                  <div class="warning">
                      <div class="warning-title">⚠️ Important Security Information</div>
                      <div class="warning-text">
                          This password reset link will expire in 1 hour for security reasons. 
                          If you don't reset your password within this time, you'll need to request a new reset link.
                      </div>
                  </div>
                  
                  <div class="security-info">
                      <div class="security-title">🔒 Security Notice</div>
                      <div class="security-text">
                          • If you didn't request this password reset, please ignore this email or contact our support team immediately.<br>
                          • Never share your password reset link with anyone.<br>
                          • Make sure to choose a strong, unique password for your account.<br>
                          • For your security, this link can only be used once.
                      </div>
                  </div>
                  
                  <div class="message">
                      Thank you for using Citizens for Change to advance sustainable development and environmental monitoring.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated message from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <div class="footer-links">
                      <a href="#">Privacy Policy</a>
                      <a href="#">Terms of Service</a>
                      <a href="#">Help Center</a>
                  </div>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate welcome email template for new users
   */
  static generateWelcomeEmail(data: WelcomeEmailData): string {
    const { userName, userEmail, loginURL, role, organizationName } = data;
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Citizens for Change</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .welcome-title {
                  font-size: 24px;
                  font-weight: bold;
                  color: #059669;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .login-button {
                  display: inline-block;
                  background-color: #059669;
                  color: white !important;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 2px 4px rgba(5, 150, 105, 0.3);
              }
              .login-button:hover {
                  background-color: #047857;
              }
              .account-details {
                  background-color: #f0f9ff;
                  border-left: 4px solid #0ea5e9;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 6px;
              }
              .account-title {
                  font-weight: 600;
                  color: #0369a1;
                  margin-bottom: 10px;
              }
              .account-info {
                  color: #0c4a6e;
                  font-size: 14px;
                  line-height: 1.6;
              }
              .features-section {
                  background-color: #fafaf9;
                  padding: 20px;
                  border-radius: 8px;
                  margin: 25px 0;
              }
              .features-title {
                  font-weight: 600;
                  color: #1f2937;
                  margin-bottom: 15px;
              }
              .feature-list {
                  color: #4b5563;
                  font-size: 14px;
                  line-height: 1.8;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .footer-links {
                  margin-top: 15px;
              }
              .footer-links a {
                  color: #3b82f6;
                  text-decoration: none;
                  margin: 0 10px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="welcome-title">🎉 Welcome to Citizens for Change!</div>
              
              <div class="content">
                  <div class="greeting">Hello ${userName},</div>
                  
                  <div class="message">
                      Welcome to Citizens for Change! We're excited to have you join our community dedicated to advancing sustainable development and environmental monitoring through proper due diligence and GDPR compliance.
                  </div>
                  
                  <div class="account-details">
                      <div class="account-title">Your Account Details</div>
                      <div class="account-info">
                          <strong>Email:</strong> ${userEmail}<br>
                          ${role ? `<strong>Role:</strong> ${role}<br>` : ''}
                          ${organizationName ? `<strong>Organization:</strong> ${organizationName}<br>` : ''}
                          <strong>Account Created:</strong> ${new Date().toLocaleDateString()}
                      </div>
                  </div>
                  
                  <div class="message">
                      You can now access your dashboard and start creating projects, conducting surveys, and analyzing results to ensure compliance with carbon sector regulations.
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${loginURL}" class="login-button">Access Your Dashboard</a>
                  </div>
                  
                  <div class="features-section">
                      <div class="features-title">🚀 What you can do with Citizens for Change:</div>
                      <div class="feature-list">
                          • <strong>Build:</strong> Create curated surveys for local communities affected by your projects<br>
                          • <strong>Measure:</strong> Analyze survey responses based on specific conditions and criteria<br>
                          • <strong>Learn:</strong> Visualize results through comprehensive dashboards and insights<br>
                          • <strong>Tell:</strong> Compile and share results with relevant stakeholders<br>
                          • <strong>Comply:</strong> Ensure GDPR compliance and proper due diligence throughout your process
                      </div>
                  </div>
                  
                  <div class="message">
                      If you have any questions or need assistance getting started, our support team is here to help. Don't hesitate to reach out!
                  </div>
                  
                  <div class="message">
                      Thank you for choosing Citizens for Change to make a positive impact on sustainable development.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated welcome message from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <div class="footer-links">
                      <a href="#">Getting Started Guide</a>
                      <a href="#">Documentation</a>
                      <a href="#">Help Center</a>
                  </div>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate password changed confirmation email
   */
  static generatePasswordChangedEmail(userName: string, userEmail: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Citizens for Change - Password Changed</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .success-title {
                  font-size: 20px;
                  font-weight: bold;
                  color: #059669;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .success-info {
                  background-color: #ecfdf5;
                  border-left: 4px solid #10b981;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 6px;
              }
              .success-text {
                  color: #047857;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .security-info {
                  background-color: #eff6ff;
                  border-left: 4px solid #3b82f6;
                  padding: 15px;
                  margin: 20px 0;
              }
              .security-title {
                  font-weight: 600;
                  color: #1e40af;
                  margin-bottom: 8px;
              }
              .security-text {
                  color: #1e3a8a;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="success-title">✅ Password Successfully Changed</div>
              
              <div class="content">
                  <div class="greeting">Hello ${userName},</div>
                  
                  <div class="message">
                      This email confirms that the password for your Citizens for Change account (<strong>${userEmail}</strong>) has been successfully changed.
                  </div>
                  
                  <div class="success-info">
                      <div class="success-text">
                          ✓ Password changed on: ${new Date().toLocaleString()}<br>
                          ✓ Your account is secure and ready to use
                      </div>
                  </div>
                  
                  <div class="security-info">
                      <div class="security-title">🔒 Security Notice</div>
                      <div class="security-text">
                          If you did not make this change, please contact our support team immediately at 
                          <a href="mailto:support@valuescopeyouthimpact.com" style="color: #1e40af;">support@valuescopeyouthimpact.com</a>
                      </div>
                  </div>
                  
                  <div class="message">
                      You can now log in to your account using your new password. Thank you for keeping your Citizens for Change account secure.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated security notification from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate account verification email template
   */
  static generateAccountVerificationEmail(userName: string, userEmail: string, verificationURL: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Citizens for Change - Verify Your Account</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .verify-title {
                  font-size: 24px;
                  font-weight: bold;
                  color: #7c3aed;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .verify-button {
                  display: inline-block;
                  background-color: #7c3aed;
                  color: white !important;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
              }
              .verify-button:hover {
                  background-color: #6d28d9;
              }
              .verify-url {
                  background-color: #f3f4f6;
                  padding: 15px;
                  border-radius: 6px;
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  word-break: break-all;
                  color: #374151;
                  margin: 15px 0;
                  border-left: 4px solid #7c3aed;
              }
              .info-box {
                  background-color: #f0f9ff;
                  border-left: 4px solid #0ea5e9;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 6px;
              }
              .info-title {
                  font-weight: 600;
                  color: #0369a1;
                  margin-bottom: 8px;
              }
              .info-text {
                  color: #0c4a6e;
                  font-size: 14px;
                  line-height: 1.5;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="verify-title">📧 Verify Your Email Address</div>
              
              <div class="content">
                  <div class="greeting">Hello ${userName},</div>
                  
                  <div class="message">
                      Thank you for creating an account with Citizens for Change! To complete your registration and start using our platform, please verify your email address (<strong>${userEmail}</strong>).
                  </div>
                  
                  <div class="message">
                      Click the button below to verify your account:
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${verificationURL}" class="verify-button">Verify My Account</a>
                  </div>
                  
                  <div class="message">
                      If the button doesn't work, you can copy and paste the following link into your browser:
                  </div>
                  
                  <div class="verify-url">${verificationURL}</div>
                  
                  <div class="info-box">
                      <div class="info-title">ℹ️ Important Information</div>
                      <div class="info-text">
                          • This verification link will expire in 24 hours<br>
                          • You must verify your email to access all platform features<br>
                          • If you didn't create this account, please ignore this email
                      </div>
                  </div>
                  
                  <div class="message">
                      Once verified, you'll have full access to Citizens for Change's features for sustainable monitoring, reporting, and verification.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated verification email from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

/**
   * Generate the Citizens for Change invitation email.
   * Tone: warm, personal, low-friction — copy is the master from Notion (12 Jun 2026).
   */
  static generateC4CInvitationEmail(data: {
    organizationName: string;
    invitationURL: string;
  }): string {
    const { organizationName, invitationURL } = data;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've been invited to join ${organizationName} on Citizens for Change</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;padding:48px 48px 40px;max-width:560px;">

                <!-- Logo / brand mark -->
                <tr>
                  <td style="padding-bottom:32px;border-bottom:1px solid #eeeeee;">
                    <span style="font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:-0.3px;">Citizens for Change</span>
                  </td>
                </tr>

                <!-- Body copy -->
                <tr>
                  <td style="padding-top:32px;">
                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#1a1a2e;">
                      Hi there!
                    </p>

                    <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#1a1a2e;">
                      You've been invited to join <strong>${organizationName}</strong> on Citizens for Change — it's brilliant to have you on board.
                    </p>

                    <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#1a1a2e;">
                      Once you accept below, you'll land straight in your Project workspace and can get started. If anything feels unclear or you'd just like a hand finding your feet, drop me an email at <a href="mailto:hannah@citizens4change.net" style="color:#624CF5;text-decoration:none;">hannah@citizens4change.net</a> — I'm happy to help.
                    </p>

                    <!-- CTA -->
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                      <tr>
                        <td>
                          <a href="${invitationURL}"
                             style="display:inline-block;padding:14px 32px;background-color:#624CF5;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 32px;font-size:13px;line-height:1.6;color:#888888;">
                      This link expires in 72 hours. If you weren't expecting this, you can safely ignore it.
                    </p>

                    <p style="margin:0;font-size:16px;line-height:1.7;color:#1a1a2e;">
                      Warm wishes,<br>
                      <strong>Hannah</strong>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding-top:40px;border-top:1px solid #eeeeee;margin-top:40px;">
                    <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
                      Citizens for Change &copy; 2026.<br>
                      If the button above doesn't work, paste this link into your browser:<br>
                      <a href="${invitationURL}" style="color:#624CF5;word-break:break-all;">${invitationURL}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Generate project invitation email template
   */
  static generateProjectInvitationEmail(data: {
    inviteeName: string;
    inviterName: string;
    projectName: string;
    organizationName: string;
    role: string;
    invitationURL: string;
    userEmail: string;
  }): string {
    const { inviteeName, inviterName, projectName, organizationName, role, invitationURL, userEmail } = data;
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Citizens for Change - Project Invitation</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .invitation-title {
                  font-size: 24px;
                  font-weight: bold;
                  color: #8b5cf6;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .invitation-details {
                  background-color: #faf5ff;
                  border-left: 4px solid #8b5cf6;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 6px;
              }
              .details-title {
                  font-weight: 600;
                  color: #7c3aed;
                  margin-bottom: 10px;
              }
              .details-info {
                  color: #581c87;
                  font-size: 14px;
                  line-height: 1.6;
              }
              .accept-button {
                  display: inline-block;
                  background-color: #8b5cf6;
                  color: white !important;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
              }
              .accept-button:hover {
                  background-color: #7c3aed;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="invitation-title">🤝 You're Invited to Join a Project!</div>
              
              <div class="content">
                  <div class="greeting">Hello ${inviteeName},</div>
                  
                  <div class="message">
                      <strong>${inviterName}</strong> has invited you to collaborate on the <strong>"${projectName}"</strong> project on Citizens for Change.
                  </div>
                  
                  <div class="invitation-details">
                      <div class="details-title">Invitation Details</div>
                      <div class="details-info">
                          <strong>Project:</strong> ${projectName}<br>
                          <strong>Organization:</strong> ${organizationName}<br>
                          <strong>Your Role:</strong> ${role}<br>
                          <strong>Invited By:</strong> ${inviterName}<br>
                          <strong>Invitation Date:</strong> ${new Date().toLocaleDateString()}
                      </div>
                  </div>
                  
                  <div class="message">
                      As a <strong>${role}</strong> on this project, you'll be able to contribute to sustainable development initiatives and help ensure compliance with carbon sector regulations.
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${invitationURL}" class="accept-button">Accept Invitation</a>
                  </div>
                  
                  <div class="message">
                      If you don't have an Citizens for Change account yet, you'll be guided through the registration process when you click the invitation link.
                  </div>
                  
                  <div class="message">
                      This invitation was sent to <strong>${userEmail}</strong>. If you weren't expecting this invitation, you can safely ignore this email.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated invitation from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate survey completion reminder email
   */
  static generateSurveyReminderEmail(data: {
    recipientName: string;
    surveyTitle: string;
    projectName: string;
    dueDate: string;
    surveyURL: string;
    organizationName: string;
  }): string {
    const { recipientName, surveyTitle, projectName, dueDate, surveyURL, organizationName } = data;
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Citizens for Change - Survey Reminder</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #f8fafc;
              }
              .container {
                  background-color: #ffffff;
                  padding: 40px;
                  border-radius: 12px;
                  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e5e7eb;
              }
              .logo {
                  font-size: 28px;
                  font-weight: bold;
                  color: #1f2937;
                  margin-bottom: 8px;
              }
              .subtitle {
                  color: #6b7280;
                  font-size: 16px;
              }
              .reminder-title {
                  font-size: 20px;
                  font-weight: bold;
                  color: #f59e0b;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .content {
                  margin-bottom: 30px;
              }
              .greeting {
                  font-size: 18px;
                  color: #1f2937;
                  margin-bottom: 20px;
              }
              .message {
                  color: #4b5563;
                  margin-bottom: 25px;
                  line-height: 1.7;
              }
              .survey-details {
                  background-color: #fffbeb;
                  border-left: 4px solid #f59e0b;
                  padding: 20px;
                  margin: 20px 0;
                  border-radius: 6px;
              }
              .details-title {
                  font-weight: 600;
                  color: #d97706;
                  margin-bottom: 10px;
              }
              .details-info {
                  color: #92400e;
                  font-size: 14px;
                  line-height: 1.6;
              }
              .complete-button {
                  display: inline-block;
                  background-color: #f59e0b;
                  color: white !important;
                  padding: 14px 28px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
              }
              .complete-button:hover {
                  background-color: #d97706;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
              }
              .support-email {
                  color: #3b82f6;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">Citizens for Change</div>
                  <div class="subtitle">Sustainable Monitoring, Reporting & Verification</div>
              </div>
              
              <div class="reminder-title">⏰ Survey Completion Reminder</div>
              
              <div class="content">
                  <div class="greeting">Hello ${recipientName},</div>
                  
                  <div class="message">
                      This is a friendly reminder that you have a pending survey to complete as part of the <strong>"${projectName}"</strong> project.
                  </div>
                  
                  <div class="survey-details">
                      <div class="details-title">Survey Details</div>
                      <div class="details-info">
                          <strong>Survey:</strong> ${surveyTitle}<br>
                          <strong>Project:</strong> ${projectName}<br>
                          <strong>Organization:</strong> ${organizationName}<br>
                          <strong>Due Date:</strong> ${dueDate}
                      </div>
                  </div>
                  
                  <div class="message">
                      Your input is valuable for ensuring proper due diligence and GDPR compliance in this sustainable development initiative.
                  </div>
                  
                  <div style="text-align: center;">
                      <a href="${surveyURL}" class="complete-button">Complete Survey</a>
                  </div>
                  
                  <div class="message">
                      Thank you for your participation in advancing sustainable development and environmental monitoring.
                  </div>
              </div>
              
              <div class="footer">
                  <p>This is an automated reminder from Citizens for Change.</p>
                  <p>If you need assistance, contact our support team at 
                     <a href="mailto:support@valuescopeyouthimpact.com" class="support-email">support@valuescopeyouthimpact.com</a>
                  </p>
                  <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                      © 2026 Citizens for Change. All rights reserved.
                  </p>
              </div>
          </div>
      </body>
      </html>
    `;
  }
}

export default EmailTemplateService;