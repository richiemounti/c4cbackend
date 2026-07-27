"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/questionLibrary.routes.ts
const express_1 = require("express");
const questionLibrary_controller_1 = require("../controllers/questionLibrary.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const questionLibraryRouter = (0, express_1.Router)();
// Public/protected routes
questionLibraryRouter.get('/', questionLibrary_controller_1.getQuestionLibraries);
questionLibraryRouter.get('/:id', questionLibrary_controller_1.getQuestionLibrary);
// ConnectGo staff only routes
questionLibraryRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.createQuestionLibrary);
questionLibraryRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.updateQuestionLibrary);
questionLibraryRouter.post('/:id/questions', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.addQuestionsToLibrary);
questionLibraryRouter.delete('/:id/questions', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.removeQuestionsFromLibrary);
questionLibraryRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.archiveQuestionLibrary);
questionLibraryRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.restoreQuestionLibrary);
questionLibraryRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), questionLibrary_controller_1.deleteQuestionLibrary);
exports.default = questionLibraryRouter;
//# sourceMappingURL=questionLibrary.routes.js.map