// routes/document.routes.ts
import { Router } from "express";
import {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocumentById
} from "../controllers/document.controller";
import { upload } from "../middlewares/upload.middleware";
import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess } from "../middlewares/role.middleware";

const documentRouter = Router();

// Get all documents (with filtering)
documentRouter.get('/', authorize, getDocuments);

// Get a single document by ID
documentRouter.get('/:id', authorize, getDocument);

// Upload a document
// The 'file' field name should match what's used in the frontend form
documentRouter.post(
  '/', 
  authorize,
  upload.single('file'), 
  uploadDocument
);

// Delete a document
documentRouter.delete('/:id', authorize, deleteDocumentById);

// Project-specific document routes
// These routes assume you might want to get all documents for a specific project
documentRouter.get(
  '/project/:projectId',
  authorize,
  hasProjectAccess(), // Middleware to check if user has access to this project
  (req, res, next) => {
    // Set project ID in query params for the getDocuments controller
    req.query.projectId = req.params.projectId;
    getDocuments(req, res, next);
  }
);

// Site-specific document routes
// These routes assume you might want to get all documents for a specific site
documentRouter.get(
  '/site/:siteId',
  authorize,
  (req, res, next) => {
    // Set site ID in query params for the getDocuments controller
    req.query.siteId = req.params.siteId;
    getDocuments(req, res, next);
  }
);

// Upload document specifically for a project
documentRouter.post(
  '/project/:projectId',
  authorize,
  hasProjectAccess(), // Middleware to check if user has access to this project
  upload.single('file'),
  (req, res, next) => {
    // Set project ID in req.body for the uploadDocument controller
    req.body.projectId = req.params.projectId;
    uploadDocument(req, res, next);
  }
);

// Upload document specifically for a site
documentRouter.post(
  '/site/:siteId',
  authorize,
  upload.single('file'),
  (req, res, next) => {
    // Set site ID in req.body for the uploadDocument controller
    req.body.siteId = req.params.siteId;
    // You'll need to extract the projectId from the site or include it in the route
    // For example: /project/:projectId/site/:siteId/document
    uploadDocument(req, res, next);
  }
);

export default documentRouter;