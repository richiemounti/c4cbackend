"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/projectSetup.routes.ts
const express_1 = require("express");
const projectSetupReportController_1 = require("../../controllers/reports/projectSetupReportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const role_middleware_1 = require("../../middlewares/role.middleware");
const projectSetupReportRouter = (0, express_1.Router)();
// Generate project setup report
projectSetupReportRouter.post('/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), projectSetupReportController_1.generateProjectSetupReport);
// Get project setup summary stats
projectSetupReportRouter.get('/:projectId/summary', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), projectSetupReportController_1.getProjectSetupSummary);
exports.default = projectSetupReportRouter;
//# sourceMappingURL=projectSetup.routes.js.map