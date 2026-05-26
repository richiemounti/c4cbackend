import express from 'express';
import cors from 'cors';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { env, validateEnv, validateGmailConfig  } from './config/env';
import passport from 'passport';


// Import routes
import authRouter from './routes/auth.routes';
import oauthRouter from './routes/oauth.routes';  // Add OAuth routes
import userRouter from './routes/users.routes';
import organizationRouter from './routes/organization.routes';
import projectRouter from './routes/project.routes';
import organizationProjectsRouter from './routes/organization-projects.routes';
import stakeholderRouter from './routes/stakeholder.routes';
import subscriptionRouter from './routes/subscription.routes';
import healthRouter from './routes/health.routes';
import categoryRouter from "./routes/category.routes";
import themeRouter from "./routes/theme.routes";
import subThemeRouter from "./routes/subtheme.routes";
import questionRouter from "./routes/question.routes";
import questionLibraryRouter from "./routes/questionLibrary.routes";
import surveyRouter from "./routes/survey.routes";
import sectionRouter from "./routes/surveySection.routes";
import surveyQuestionRouter from "./routes/surveyQuestion.routes";
import responseRouter from "./routes/surveyResponse.routes";
import bugReportRouter from './routes/bugReport.routes';
import indicatorRouter from './routes/indicator.routes';
import { projectSiteRouter } from './routes/projectSite.routes';
import stakeholderMappingRouter from './routes/stakeholderMapping.routes';
import stakeholderReportRouter from './routes/stakeholderReport.routes';
import documentRouter from './routes/document.routes';
import projectSetupRouter from './routes/projectSetup.routes';
import tocRouter from "./routes/theoryOfChange.routes";
import sdgRouter from './routes/sdg.routes';
import resilienceDimensionRouter from './routes/resilienceDimension.routes';
import esgCategoryRouter from './routes/esgCategory.routes';
import standardRouter from './routes/standard.routes';
import consultationRouter from './routes/tocConsultationPlan.routes';
import adminDashboardRouter from './routes/adminDashboard.routes';
import eulaRouter from './routes/eula.routes';
import surveyBuilderRouter from './routes/surveyBuilder.routes';
import emailDebugRouter from './routes/emailDebug.routes';
import taskRouter from "./routes/taskUpdate.routes";
import riskManagementRouter from './routes/riskManagement.routes';
import reportsRouter from './routes/reports';
import tempMigrationRouter from './routes/tempMigration.routes';
// import reviewRouter from './routes/reviewManagement.routes';
import translationRouter from "./routes/translation.routes";
import consentFormRouter from "./routes/consentForm.routes";
import streamChatRoutes from './routes/streamChat.routes';
import reviewRoutes from './routes/review.routes';
import pulseRouter from './routes/pulseSurvey.routes';

// import mobile router 
import mobileRouter from './routes/mobile.routes';

import inboxRouter from './routes/inbox.routes';





// Custom middleware
import errorMiddleWare from './middlewares/error.middleware';
import { globalEulaCheck } from './middlewares/eula.middleware';
import arcjetMiddleware from './middlewares/arcjet.middleware';
import { ReportCacheService } from './services/reports/reportCache.service';
import riskAnalyticsRouter from './routes/riskAnalytics.routes';




// Validate environment variables
validateEnv();
validateGmailConfig();

// Create Express app
const app = express();


const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  // Add frontend URL from environment
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Add additional origins if specified
  if (process.env.ALLOWED_ORIGINS) {
    const additional = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    origins.push(...additional);
  }
  
  // Remove duplicates
  const uniqueOrigins = [...new Set(origins)];
  
  console.log('🌐 Allowed CORS origins:', uniqueOrigins);
  return uniqueOrigins;
};


const corsOptions = {
  origin: getAllowedOrigins(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Middleware setup
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(join(__dirname, 'public')));




// Initialize Passport
app.use(passport.initialize());


// Routes
app.get('/', (req, res) => {
  res.send('Welcome to the Youth Impact Platform backend API');
});

// Health check route (should be publicly accessible)
app.use('/health', healthRouter);


// Mount the auth routes
app.use('/api/v1/auth', authRouter);

// Mount the OAuth routes on /auth path
app.use('/api/v1/auth', oauthRouter);

// Mount the user routes
app.use('/api/v1/users', userRouter);

// Mount the organization routes
app.use('/api/v1/organizations', organizationRouter);

// Mount the nested routes for organization projects
app.use('/api/v1/organizations/:organizationId/projects', organizationProjectsRouter);

// Mount the project routes
app.use('/api/v1/projects', projectRouter);

// Mount the stakeholder routes
app.use('/api/v1/stakeholders', stakeholderRouter);

// Mount the subscription routes
app.use('/api/v1/subscriptions', subscriptionRouter);

// Mount the category routes
app.use('/api/v1/categories', categoryRouter);

// Mount the theme routes
app.use('/api/v1/themes', themeRouter);

// Mount the subtheme routes
app.use('/api/v1/subthemes', subThemeRouter);

// Mount the question routes
app.use('/api/v1/questions', questionRouter);

// Mount the questionLibrary routes
app.use('/api/v1/questionlibrary', questionLibraryRouter);

// Mount the survey routes
app.use('/api/v1/surveys', surveyRouter);

// Mount the direct translation routes
app.use('/api/v1/translations', translationRouter);

// Mount the bug-reporter routes
app.use('/api/v1/bug-reports', bugReportRouter);

// Mount the indicator routes
app.use('/api/v1/indicators', indicatorRouter);

// Register the project site routes
app.use('/api/v1/project-sites', projectSiteRouter);

// Register the stakeholder mapping routes
app.use('/api/v1/stakeholderMapping', stakeholderMappingRouter); // Add this line

// Register the stakeholder report routes
app.use('/api/v1/stakeholderReports', stakeholderReportRouter)

// Mount the document routes
app.use('/api/v1/documents', documentRouter);

// Mount the project setup routes
// Mount the document routes
app.use('/api/v1/setup', projectSetupRouter);

// Mount the theory of change routes
app.use('/api/v1/theoryOfChange', tocRouter);

//Mount the consultation routes
app.use('/api/v1/consultation', consultationRouter);

//Mount the admin dashboard routes
app.use('/api/v1/admin', adminDashboardRouter);

// Risk management routes (role-based access)
app.use('/api/v1/admin', riskAnalyticsRouter);
app.use('/api/v1/admin', riskManagementRouter);

app.use('/api/v1/sdgs', sdgRouter);
app.use('/api/v1/resilience-dimensions', resilienceDimensionRouter);
app.use('/api/v1/esg-categories', esgCategoryRouter);
app.use('/api/v1/standards', standardRouter);
app.use('/api/v1/eula', eulaRouter);
app.use('/api/v1/debug', emailDebugRouter);

app.use('/api/v1/admin/tasks', taskRouter);

app.use('/api/v1/reports', reportsRouter)

// Add this route (put it with your other route registrations)
app.use('/api/v1/temp', tempMigrationRouter);

// mount the reviews router
app.use('/api/v1/reviews', reviewRoutes);

// Mount the consent form routes
app.use('/api/v1/consent-forms', consentFormRouter);

// Mount streamChat routes
app.use('/api/v1/stream-chat', streamChatRoutes);

// Add this line with your other routes
app.use('/api/v1/pulse-surveys', pulseRouter);

// mobile router
app.use('/api/v1/mobile', mobileRouter);

// inbox router
app.use('/api/v1/inbox', inboxRouter);





// Mount custom middleware
app.use(errorMiddleWare);
app.use(globalEulaCheck);
//app.use(arcjetMiddleware);


// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: 'Something went wrong!' });
});

// Now you can use env variables
console.log(`Running in ${env.NODE_ENV} mode on port ${env.PORT}`);

export default app;