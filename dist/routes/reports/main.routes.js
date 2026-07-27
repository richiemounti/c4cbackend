"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/main.routes.ts
const express_1 = require("express");
const reportController_1 = require("../../controllers/reports/reportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const role_middleware_1 = require("../../middlewares/role.middleware");
const mainReportsRouter = (0, express_1.Router)();
// Get all reports for a project
mainReportsRouter.get('/project/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), reportController_1.getProjectReports);
// Get specific report by ID
mainReportsRouter.get('/:reportId', auth_middleware_1.default, reportController_1.getReportById);
// Delete/Archive report
mainReportsRouter.delete('/:reportId', auth_middleware_1.default, reportController_1.deleteReport);
// Approve report (Manager/Admin only)
mainReportsRouter.put('/:reportId/approve', auth_middleware_1.default, reportController_1.approveReport);
exports.default = mainReportsRouter;
//# sourceMappingURL=main.routes.js.map