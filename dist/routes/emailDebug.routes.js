"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/emailDebug.routes.ts
const express_1 = require("express");
const emailDebug_controller_1 = require("../controllers/emailDebug.controller");
const emailDebugRouter = (0, express_1.Router)();
emailDebugRouter.get('/email', emailDebug_controller_1.debugEmailConfig);
emailDebugRouter.post('/email/test-connection', emailDebug_controller_1.testGmailConnection);
emailDebugRouter.post('/email/send-test', emailDebug_controller_1.sendTestEmail);
exports.default = emailDebugRouter;
//# sourceMappingURL=emailDebug.routes.js.map