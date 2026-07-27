"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = require("path");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const passport_1 = __importDefault(require("passport"));
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const oauth_routes_1 = __importDefault(require("./routes/oauth.routes")); // Add OAuth routes
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const organization_routes_1 = __importDefault(require("./routes/organization.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const organization_projects_routes_1 = __importDefault(require("./routes/organization-projects.routes"));
const stakeholder_routes_1 = __importDefault(require("./routes/stakeholder.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const organizationSubscription_routes_1 = __importDefault(require("./routes/organizationSubscription.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const category_routes_1 = __importDefault(require("./routes/category.routes"));
const theme_routes_1 = __importDefault(require("./routes/theme.routes"));
const subtheme_routes_1 = __importDefault(require("./routes/subtheme.routes"));
const question_routes_1 = __importDefault(require("./routes/question.routes"));
const questionLibrary_routes_1 = __importDefault(require("./routes/questionLibrary.routes"));
const survey_routes_1 = __importDefault(require("./routes/survey.routes"));
const bugReport_routes_1 = __importDefault(require("./routes/bugReport.routes"));
const indicator_routes_1 = __importDefault(require("./routes/indicator.routes"));
const projectSite_routes_1 = require("./routes/projectSite.routes");
const stakeholderMapping_routes_1 = __importDefault(require("./routes/stakeholderMapping.routes"));
const stakeholderReport_routes_1 = __importDefault(require("./routes/stakeholderReport.routes"));
const document_routes_1 = __importDefault(require("./routes/document.routes"));
const projectSetup_routes_1 = __importDefault(require("./routes/projectSetup.routes"));
const theoryOfChange_routes_1 = __importDefault(require("./routes/theoryOfChange.routes"));
const sdg_routes_1 = __importDefault(require("./routes/sdg.routes"));
const resilienceDimension_routes_1 = __importDefault(require("./routes/resilienceDimension.routes"));
const esgCategory_routes_1 = __importDefault(require("./routes/esgCategory.routes"));
const standard_routes_1 = __importDefault(require("./routes/standard.routes"));
const tocConsultationPlan_routes_1 = __importDefault(require("./routes/tocConsultationPlan.routes"));
const adminDashboard_routes_1 = __importDefault(require("./routes/adminDashboard.routes"));
const eula_routes_1 = __importDefault(require("./routes/eula.routes"));
const emailDebug_routes_1 = __importDefault(require("./routes/emailDebug.routes"));
const taskUpdate_routes_1 = __importDefault(require("./routes/taskUpdate.routes"));
const riskManagement_routes_1 = __importDefault(require("./routes/riskManagement.routes"));
const reports_1 = __importDefault(require("./routes/reports"));
const tempMigration_routes_1 = __importDefault(require("./routes/tempMigration.routes"));
// import reviewRouter from './routes/reviewManagement.routes';
const translation_routes_1 = __importDefault(require("./routes/translation.routes"));
const consentForm_routes_1 = __importDefault(require("./routes/consentForm.routes"));
const streamChat_routes_1 = __importDefault(require("./routes/streamChat.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const pulseSurvey_routes_1 = __importDefault(require("./routes/pulseSurvey.routes"));
// import mobile router 
const mobile_routes_1 = __importDefault(require("./routes/mobile.routes"));
const inbox_routes_1 = __importDefault(require("./routes/inbox.routes"));
// Custom middleware
const error_middleware_1 = __importDefault(require("./middlewares/error.middleware"));
const eula_middleware_1 = require("./middlewares/eula.middleware");
const riskAnalytics_routes_1 = __importDefault(require("./routes/riskAnalytics.routes"));
// Validate environment variables
(0, env_1.validateEnv)();
(0, env_1.validateGmailConfig)();
// Create Express app
const app = (0, express_1.default)();
const getAllowedOrigins = () => {
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
app.use((0, cors_1.default)(corsOptions));
// Middleware setup
app.use((0, morgan_1.default)('dev'));
// Stripe webhook needs the exact raw request bytes to verify its signature - this must be
// registered before the global express.json() parser below, or the body will already have
// been consumed/parsed by the time it reaches the webhook handler.
app.use('/api/v1/subscriptions/webhook', express_1.default.raw({ type: 'application/json' }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.static((0, path_1.join)(__dirname, 'public')));
// Initialize Passport
app.use(passport_1.default.initialize());
// Routes
app.get('/', (req, res) => {
    res.send('Welcome to the Youth Impact Platform backend API');
});
// Health check route (should be publicly accessible)
app.use('/health', health_routes_1.default);
// Mount the auth routes
app.use('/api/v1/auth', auth_routes_1.default);
// Mount the OAuth routes on /auth path
app.use('/api/v1/auth', oauth_routes_1.default);
// Mount the user routes
app.use('/api/v1/users', users_routes_1.default);
// Mount the organization routes
app.use('/api/v1/organizations', organization_routes_1.default);
// Mount the nested routes for organization projects
app.use('/api/v1/organizations/:organizationId/projects', organization_projects_routes_1.default);
// Mount the nested routes for an organization's subscription/billing
app.use('/api/v1/organizations/:organizationId/subscription', organizationSubscription_routes_1.default);
// Mount the project routes
app.use('/api/v1/projects', project_routes_1.default);
// Mount the stakeholder routes
app.use('/api/v1/stakeholders', stakeholder_routes_1.default);
// Mount the subscription routes
app.use('/api/v1/subscriptions', subscription_routes_1.default);
// Mount the category routes
app.use('/api/v1/categories', category_routes_1.default);
// Mount the theme routes
app.use('/api/v1/themes', theme_routes_1.default);
// Mount the subtheme routes
app.use('/api/v1/subthemes', subtheme_routes_1.default);
// Mount the question routes
app.use('/api/v1/questions', question_routes_1.default);
// Mount the questionLibrary routes
app.use('/api/v1/questionlibrary', questionLibrary_routes_1.default);
// Mount the survey routes
app.use('/api/v1/surveys', survey_routes_1.default);
// Mount the direct translation routes
app.use('/api/v1/translations', translation_routes_1.default);
// Mount the bug-reporter routes
app.use('/api/v1/bug-reports', bugReport_routes_1.default);
// Mount the indicator routes
app.use('/api/v1/indicators', indicator_routes_1.default);
// Register the project site routes
app.use('/api/v1/project-sites', projectSite_routes_1.projectSiteRouter);
// Register the stakeholder mapping routes
app.use('/api/v1/stakeholderMapping', stakeholderMapping_routes_1.default); // Add this line
// Register the stakeholder report routes
app.use('/api/v1/stakeholderReports', stakeholderReport_routes_1.default);
// Mount the document routes
app.use('/api/v1/documents', document_routes_1.default);
// Mount the project setup routes
// Mount the document routes
app.use('/api/v1/setup', projectSetup_routes_1.default);
// Mount the theory of change routes
app.use('/api/v1/theoryOfChange', theoryOfChange_routes_1.default);
//Mount the consultation routes
app.use('/api/v1/consultation', tocConsultationPlan_routes_1.default);
//Mount the admin dashboard routes
app.use('/api/v1/admin', adminDashboard_routes_1.default);
// Risk management routes (role-based access)
app.use('/api/v1/admin', riskAnalytics_routes_1.default);
app.use('/api/v1/admin', riskManagement_routes_1.default);
app.use('/api/v1/sdgs', sdg_routes_1.default);
app.use('/api/v1/resilience-dimensions', resilienceDimension_routes_1.default);
app.use('/api/v1/esg-categories', esgCategory_routes_1.default);
app.use('/api/v1/standards', standard_routes_1.default);
app.use('/api/v1/eula', eula_routes_1.default);
app.use('/api/v1/debug', emailDebug_routes_1.default);
app.use('/api/v1/admin/tasks', taskUpdate_routes_1.default);
app.use('/api/v1/reports', reports_1.default);
// Add this route (put it with your other route registrations)
app.use('/api/v1/temp', tempMigration_routes_1.default);
// mount the reviews router
app.use('/api/v1/reviews', review_routes_1.default);
// Mount the consent form routes
app.use('/api/v1/consent-forms', consentForm_routes_1.default);
// Mount streamChat routes
app.use('/api/v1/stream-chat', streamChat_routes_1.default);
// Add this line with your other routes
app.use('/api/v1/pulse-surveys', pulseSurvey_routes_1.default);
// mobile router
app.use('/api/v1/mobile', mobile_routes_1.default);
// inbox router
app.use('/api/v1/inbox', inbox_routes_1.default);
// Mount custom middleware
app.use(error_middleware_1.default);
app.use(eula_middleware_1.globalEulaCheck);
//app.use(arcjetMiddleware);
// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ error: 'Something went wrong!' });
});
// Now you can use env variables
console.log(`Running in ${env_1.env.NODE_ENV} mode on port ${env_1.env.PORT}`);
exports.default = app;
//# sourceMappingURL=app.js.map