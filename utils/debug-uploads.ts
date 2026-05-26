// debug-uploads.ts - Diagnostic Script for Upload Issues
import 'dotenv/config';

/**
 * This script helps diagnose upload configuration issues
 * Run with: ts-node debug-uploads.ts
 */

interface DiagnosticResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  fix?: string;
}

const results: DiagnosticResult[] = [];

// Color codes for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function addResult(check: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, fix?: string) {
  results.push({ check, status, message, fix });
}

function printResults() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 UPLOAD CONFIGURATION DIAGNOSTIC REPORT');
  console.log('='.repeat(70) + '\n');

  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  results.forEach(result => {
    let color;
    let icon;
    
    switch (result.status) {
      case 'PASS':
        color = colors.green;
        icon = '✅';
        passCount++;
        break;
      case 'FAIL':
        color = colors.red;
        icon = '❌';
        failCount++;
        break;
      case 'WARN':
        color = colors.yellow;
        icon = '⚠️ ';
        warnCount++;
        break;
    }

    console.log(`${color}${icon} ${result.check}${colors.reset}`);
    console.log(`   ${result.message}`);
    if (result.fix) {
      console.log(`   ${colors.blue}Fix: ${result.fix}${colors.reset}`);
    }
    console.log('');
  });

  console.log('='.repeat(70));
  console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warnCount} warnings`);
  console.log('='.repeat(70) + '\n');

  if (failCount > 0) {
    console.log(`${colors.red}⛔ Critical issues found. Please fix the failed checks above.${colors.reset}\n`);
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`${colors.yellow}⚠️  Some warnings found. Uploads might work but not optimally.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ All checks passed! Your upload configuration looks good.${colors.reset}\n`);
  }
}

async function runDiagnostics() {
  console.log('Starting diagnostics...\n');

  // Check 1: Environment Variables
  console.log('Checking environment variables...');
  const storageProvider = process.env.STORAGE_PROVIDER || 'cloudinary';
  
  if (storageProvider === 'cloudinary') {
    const hasCloudName = !!process.env.CLOUDINARY_CLOUD_NAME;
    const hasApiKey = !!process.env.CLOUDINARY_API_KEY;
    const hasApiSecret = !!process.env.CLOUDINARY_API_SECRET;

    if (hasCloudName && hasApiKey && hasApiSecret) {
      addResult(
        'Cloudinary Environment Variables',
        'PASS',
        'All required Cloudinary variables are set'
      );
    } else {
      const missing = [];
      if (!hasCloudName) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!hasApiKey) missing.push('CLOUDINARY_API_KEY');
      if (!hasApiSecret) missing.push('CLOUDINARY_API_SECRET');
      
      addResult(
        'Cloudinary Environment Variables',
        'FAIL',
        `Missing variables: ${missing.join(', ')}`,
        'Add these variables to your .env file. Sign up at https://cloudinary.com'
      );
    }
  } else if (storageProvider === 'gcs') {
    const hasProjectId = !!process.env.GCS_PROJECT_ID;
    const hasBucket = !!process.env.GCS_BUCKET_NAME;
    const hasKeyFile = !!process.env.GCS_KEY_FILE_PATH;
    const hasCredentials = !!process.env.GCS_CREDENTIALS;

    if (hasProjectId && hasBucket && (hasKeyFile || hasCredentials)) {
      addResult(
        'Google Cloud Storage Environment Variables',
        'PASS',
        'All required GCS variables are set'
      );
    } else {
      const missing = [];
      if (!hasProjectId) missing.push('GCS_PROJECT_ID');
      if (!hasBucket) missing.push('GCS_BUCKET_NAME');
      if (!hasKeyFile && !hasCredentials) {
        missing.push('GCS_KEY_FILE_PATH or GCS_CREDENTIALS');
      }
      
      addResult(
        'Google Cloud Storage Environment Variables',
        'FAIL',
        `Missing variables: ${missing.join(', ')}`,
        'Add these variables to your .env file. Create a service account in Google Cloud Console'
      );
    }
  }

  // Check 2: Multer Configuration
  console.log('Checking multer configuration...');
  try {
    const multer = require('multer');
    addResult(
      'Multer Package',
      'PASS',
      'Multer is installed'
    );
  } catch (error) {
    addResult(
      'Multer Package',
      'FAIL',
      'Multer is not installed',
      'Run: npm install multer'
    );
  }

  // Check 3: Storage Service Dependencies
  console.log('Checking storage service dependencies...');
  
  if (storageProvider === 'cloudinary') {
    try {
      require('cloudinary');
      addResult(
        'Cloudinary Package',
        'PASS',
        'Cloudinary package is installed'
      );

      // Try to test connection
      try {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        const result = await cloudinary.api.ping();
        if (result.status === 'ok') {
          addResult(
            'Cloudinary Connection',
            'PASS',
            'Successfully connected to Cloudinary'
          );
        }
      } catch (error: any) {
        addResult(
          'Cloudinary Connection',
          'FAIL',
          `Cannot connect to Cloudinary: ${error.message}`,
          'Check your credentials are correct and you have internet access'
        );
      }
    } catch (error) {
      addResult(
        'Cloudinary Package',
        'FAIL',
        'Cloudinary package is not installed',
        'Run: npm install cloudinary'
      );
    }
  } else if (storageProvider === 'gcs') {
    try {
      require('@google-cloud/storage');
      addResult(
        'Google Cloud Storage Package',
        'PASS',
        'Google Cloud Storage package is installed'
      );

      // Try to test connection
      try {
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage({
          projectId: process.env.GCS_PROJECT_ID,
          ...(process.env.GCS_KEY_FILE_PATH 
            ? { keyFilename: process.env.GCS_KEY_FILE_PATH }
            : process.env.GCS_CREDENTIALS 
            ? { credentials: JSON.parse(process.env.GCS_CREDENTIALS) }
            : {}
          )
        });

        const bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');
        const [exists] = await bucket.exists();
        
        if (exists) {
          addResult(
            'Google Cloud Storage Connection',
            'PASS',
            'Successfully connected to GCS bucket'
          );
        } else {
          addResult(
            'Google Cloud Storage Connection',
            'FAIL',
            `Bucket '${process.env.GCS_BUCKET_NAME}' does not exist`,
            'Create the bucket in Google Cloud Console or fix the bucket name'
          );
        }
      } catch (error: any) {
        addResult(
          'Google Cloud Storage Connection',
          'FAIL',
          `Cannot connect to GCS: ${error.message}`,
          'Check your credentials and bucket configuration'
        );
      }
    } catch (error) {
      addResult(
        'Google Cloud Storage Package',
        'FAIL',
        'Google Cloud Storage package is not installed',
        'Run: npm install @google-cloud/storage'
      );
    }
  }

  // Check 4: File Size Limits
  console.log('Checking file size configuration...');
  const maxFileSize = process.env.MAX_FILE_SIZE 
    ? parseInt(process.env.MAX_FILE_SIZE) 
    : 10 * 1024 * 1024;
  
  if (maxFileSize > 0 && maxFileSize <= 100 * 1024 * 1024) {
    addResult(
      'File Size Limit',
      'PASS',
      `Max file size: ${(maxFileSize / 1024 / 1024).toFixed(2)}MB`
    );
  } else {
    addResult(
      'File Size Limit',
      'WARN',
      `Max file size is ${maxFileSize > 100 * 1024 * 1024 ? 'very large' : 'not set'}`,
      'Set MAX_FILE_SIZE in .env (recommended: 10485760 for 10MB)'
    );
  }

  // Check 5: CORS Configuration
  console.log('Checking CORS configuration...');
  const apiUrl = process.env.API_URL;
  if (apiUrl) {
    addResult(
      'API URL Configuration',
      'PASS',
      `API URL is set to: ${apiUrl}`
    );
  } else {
    addResult(
      'API URL Configuration',
      'WARN',
      'API_URL is not set',
      'Set API_URL in .env for proper file URL generation'
    );
  }

  // Check 6: Storage Service File
  console.log('Checking storage service file...');
  try {
    require('./services/storage.service');
    addResult(
      'Storage Service File',
      'PASS',
      'storage.service.ts exists'
    );
  } catch (error) {
    addResult(
      'Storage Service File',
      'FAIL',
      'storage.service.ts not found in ./services/',
      'Create the storage service file using the provided template'
    );
  }

  // Check 7: Production Environment
  console.log('Checking production environment...');
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    addResult(
      'Production Environment',
      'WARN',
      'Running in production mode - ensure all env vars are set on server',
      'For Hostinger VPS: Check .env file exists and PM2 loads it correctly'
    );
  } else {
    addResult(
      'Development Environment',
      'PASS',
      'Running in development mode'
    );
  }

  printResults();
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('Diagnostic script failed:', error);
  process.exit(1);
});

// Export for use in other scripts
export { runDiagnostics };