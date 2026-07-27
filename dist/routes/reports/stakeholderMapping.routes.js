"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/stakeholderMapping.routes.ts
const express_1 = require("express");
const stakeholderMappingReportController_1 = require("../../controllers/reports/stakeholderMappingReportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const role_middleware_1 = require("../../middlewares/role.middleware");
const stakeholderMappingReportRouter = (0, express_1.Router)();
// Generate stakeholder mapping report (full project)
stakeholderMappingReportRouter.post('/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set default scope to 'all' - use type assertion to fix TypeScript error
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    next();
}, stakeholderMappingReportController_1.generateStakeholderMappingReport);
// Generate site-specific stakeholder mapping report
stakeholderMappingReportRouter.post('/:projectId/site/:siteId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set filters for site-specific report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    next();
}, stakeholderMappingReportController_1.generateStakeholderMappingReport);
// Generate project-only stakeholder mapping report
stakeholderMappingReportRouter.post('/:projectId/project-only', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), (req, res, next) => {
    // Set filters for project-only report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'project';
    next();
}, stakeholderMappingReportController_1.generateStakeholderMappingReport);
exports.default = stakeholderMappingReportRouter;
//# sourceMappingURL=stakeholderMapping.routes.js.map