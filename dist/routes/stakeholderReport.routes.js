"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/stakeholderReport.routes.ts
const express_1 = require("express");
const stakeholderReport_controller_1 = require("../controllers/stakeholderReport.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const stakeholderReportRouter = (0, express_1.Router)();
// All routes require authentication
stakeholderReportRouter.use(auth_middleware_1.default);
// Get all reports
stakeholderReportRouter.get('/', stakeholderReport_controller_1.getStakeholderReports);
// Get a single report
stakeholderReportRouter.get('/:id', stakeholderReport_controller_1.getStakeholderReport);
// Generate a new report
stakeholderReportRouter.post('/', (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholderReport_controller_1.generateStakeholderReport);
// Approve a report
stakeholderReportRouter.put('/:id/approve', (0, role_middleware_1.hasPermission)(['manage_org_projects', 'approve_submissions']), stakeholderReport_controller_1.approveStakeholderReport);
// Archive a report
stakeholderReportRouter.put('/:id/archive', (0, role_middleware_1.hasPermission)(['manage_org_projects']), stakeholderReport_controller_1.archiveStakeholderReport);
// Delete a report
stakeholderReportRouter.delete('/:id', (0, role_middleware_1.hasPermission)(['manage_org_projects']), stakeholderReport_controller_1.deleteStakeholderReport);
exports.default = stakeholderReportRouter;
//# sourceMappingURL=stakeholderReport.routes.js.map