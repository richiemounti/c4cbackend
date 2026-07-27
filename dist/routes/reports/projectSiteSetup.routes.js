"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/projectSiteSetup.routes.ts
const express_1 = require("express");
const projectSiteSetupReportController_1 = require("../../controllers/reports/projectSiteSetupReportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const projectSiteSetupReportRouter = (0, express_1.Router)();
// Generate project site setup report
projectSiteSetupReportRouter.post('/:siteId', auth_middleware_1.default, projectSiteSetupReportController_1.generateProjectSiteSetupReport);
exports.default = projectSiteSetupReportRouter;
//# sourceMappingURL=projectSiteSetup.routes.js.map