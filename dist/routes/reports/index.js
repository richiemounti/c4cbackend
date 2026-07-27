"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/index.ts
const express_1 = require("express");
const main_routes_1 = __importDefault(require("./main.routes"));
const projectSetup_routes_1 = __importDefault(require("./projectSetup.routes"));
const projectSiteSetup_routes_1 = __importDefault(require("./projectSiteSetup.routes"));
const stakeholderMapping_routes_1 = __importDefault(require("./stakeholderMapping.routes"));
const riskRegister_routes_1 = __importDefault(require("./riskRegister.routes"));
const theoryOfChange_routes_1 = __importDefault(require("./theoryOfChange.routes"));
const history_routes_1 = __importDefault(require("./history.routes"));
const workflow_routes_1 = __importDefault(require("./workflow.routes"));
const enhanced_routes_1 = __importDefault(require("./enhanced.routes"));
const reportsRouter = (0, express_1.Router)();
// Mount all report route modules
reportsRouter.use('/', enhanced_routes_1.default);
reportsRouter.use('/', main_routes_1.default);
reportsRouter.use('/project-setup', projectSetup_routes_1.default);
reportsRouter.use('/project-site-setup', projectSiteSetup_routes_1.default);
reportsRouter.use('/stakeholder-mapping', stakeholderMapping_routes_1.default);
reportsRouter.use('/risk-register', riskRegister_routes_1.default);
reportsRouter.use('/theory-of-change', theoryOfChange_routes_1.default);
reportsRouter.use('/workflow', workflow_routes_1.default);
reportsRouter.use('/history', history_routes_1.default);
// Enhanced features (Phase 2 - Steps 4 & 5)
exports.default = reportsRouter;
//# sourceMappingURL=index.js.map