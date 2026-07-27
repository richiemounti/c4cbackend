"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/riskRegister.routes.ts
const express_1 = require("express");
const riskRegisterReportController_1 = require("../../controllers/reports/riskRegisterReportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const role_middleware_1 = require("../../middlewares/role.middleware");
const riskRegisterReportRouter = (0, express_1.Router)();
// Generate risk register report (full project)
riskRegisterReportRouter.post('/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set default scope to 'all'
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    next();
}, riskRegisterReportController_1.generateRiskRegisterReport);
// Generate site-specific risk register report
riskRegisterReportRouter.post('/:projectId/site/:siteId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set filters for site-specific report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    next();
}, riskRegisterReportController_1.generateRiskRegisterReport);
// Generate project-only risk register report
riskRegisterReportRouter.post('/:projectId/project-only', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set filters for project-only report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'project';
    next();
}, riskRegisterReportController_1.generateRiskRegisterReport);
// Generate overdue risks report
riskRegisterReportRouter.post('/:projectId/overdue', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set filters for overdue risks only
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'all';
    req.body.filters.overdueOnly = true;
    next();
}, riskRegisterReportController_1.generateRiskRegisterReport);
exports.default = riskRegisterReportRouter;
//# sourceMappingURL=riskRegister.routes.js.map