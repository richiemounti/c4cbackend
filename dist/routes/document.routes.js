"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/document.routes.ts
const express_1 = require("express");
const document_controller_1 = require("../controllers/document.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const documentRouter = (0, express_1.Router)();
// Get all documents (with filtering)
documentRouter.get('/', auth_middleware_1.default, document_controller_1.getDocuments);
// Get a single document by ID
documentRouter.get('/:id', auth_middleware_1.default, document_controller_1.getDocument);
// Upload a document
// The 'file' field name should match what's used in the frontend form
documentRouter.post('/', auth_middleware_1.default, upload_middleware_1.upload.single('file'), document_controller_1.uploadDocument);
// Delete a document
documentRouter.delete('/:id', auth_middleware_1.default, document_controller_1.deleteDocumentById);
// Project-specific document routes
// These routes assume you might want to get all documents for a specific project
documentRouter.get('/project/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Middleware to check if user has access to this project
(req, res, next) => {
    // Set project ID in query params for the getDocuments controller
    req.query.projectId = req.params.projectId;
    (0, document_controller_1.getDocuments)(req, res, next);
});
// Site-specific document routes
// These routes assume you might want to get all documents for a specific site
documentRouter.get('/site/:siteId', auth_middleware_1.default, (req, res, next) => {
    // Set site ID in query params for the getDocuments controller
    req.query.siteId = req.params.siteId;
    (0, document_controller_1.getDocuments)(req, res, next);
});
// Upload document specifically for a project
documentRouter.post('/project/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Middleware to check if user has access to this project
upload_middleware_1.upload.single('file'), (req, res, next) => {
    // Set project ID in req.body for the uploadDocument controller
    req.body.projectId = req.params.projectId;
    (0, document_controller_1.uploadDocument)(req, res, next);
});
// Upload document specifically for a site
documentRouter.post('/site/:siteId', auth_middleware_1.default, upload_middleware_1.upload.single('file'), (req, res, next) => {
    // Set site ID in req.body for the uploadDocument controller
    req.body.siteId = req.params.siteId;
    // You'll need to extract the projectId from the site or include it in the route
    // For example: /project/:projectId/site/:siteId/document
    (0, document_controller_1.uploadDocument)(req, res, next);
});
exports.default = documentRouter;
//# sourceMappingURL=document.routes.js.map