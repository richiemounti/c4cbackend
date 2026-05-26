// routes/reports/index.ts
import { Router } from "express";
import mainReportsRouter from "./main.routes";
import projectSetupReportRouter from "./projectSetup.routes";
import projectSiteSetupReportRouter from "./projectSiteSetup.routes";
import stakeholderMappingReportRouter from "./stakeholderMapping.routes";
import riskRegisterReportRouter from "./riskRegister.routes";
import theoryOfChangeReportRouter from "./theoryOfChange.routes";
import historyRouter from "./history.routes";
import workflowRouter from "./workflow.routes";
import enhancedReportsRouter from "./enhanced.routes";


const reportsRouter = Router();

// Mount all report route modules
reportsRouter.use('/', enhancedReportsRouter);
reportsRouter.use('/', mainReportsRouter);
reportsRouter.use('/project-setup', projectSetupReportRouter);
reportsRouter.use('/project-site-setup', projectSiteSetupReportRouter);
reportsRouter.use('/stakeholder-mapping', stakeholderMappingReportRouter);
reportsRouter.use('/risk-register', riskRegisterReportRouter);
reportsRouter.use('/theory-of-change', theoryOfChangeReportRouter);
reportsRouter.use('/workflow', workflowRouter);
reportsRouter.use('/history', historyRouter);

// Enhanced features (Phase 2 - Steps 4 & 5)


export default reportsRouter;