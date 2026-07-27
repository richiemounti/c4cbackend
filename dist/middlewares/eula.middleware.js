"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalEulaCheck = exports.EULA_EXEMPT_ROUTES = exports.addEulaStatus = exports.requireEulaAcceptance = void 0;
const eulaSignature_model_1 = __importDefault(require("../models/eulaSignature.model"));
// Current EULA version - should match the one in controller
const CURRENT_EULA_VERSION = "v3-16.06.2025";
/**
 * Middleware to check if user has signed the current EULA
 * Use this middleware on routes that require EULA acceptance
 */
const requireEulaAcceptance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        // Skip check if user is not authenticated
        if (!user || !user._id) {
            return next();
        }
        // Check if user has signed current EULA
        const hasSigned = yield eulaSignature_model_1.default.hasUserSignedCurrentEula(user._id, CURRENT_EULA_VERSION);
        if (!hasSigned) {
            const error = new Error('EULA acceptance required. Please review and accept the terms and conditions.');
            error.statusCode = 403;
            error.message = 'EULA_NOT_SIGNED';
            return next(error);
        }
        // User has signed EULA, continue
        next();
    }
    catch (error) {
        next(error);
    }
});
exports.requireEulaAcceptance = requireEulaAcceptance;
/**
 * Middleware to add EULA status to response
 * Use this on routes where you want to include EULA status in the response
 */
const addEulaStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        if (user && user._id) {
            const hasSigned = yield eulaSignature_model_1.default.hasUserSignedCurrentEula(user._id, CURRENT_EULA_VERSION);
            // Add EULA status to res.locals so it can be accessed in controllers
            res.locals.eulaStatus = {
                hasSignedCurrent: hasSigned,
                currentVersion: CURRENT_EULA_VERSION,
                requiresSignature: !hasSigned
            };
        }
        next();
    }
    catch (error) {
        // Don't fail the request if EULA check fails, just log the error
        console.error('Error checking EULA status:', error);
        next();
    }
});
exports.addEulaStatus = addEulaStatus;
/**
 * Routes that should be exempted from EULA checks
 */
exports.EULA_EXEMPT_ROUTES = [
    '/api/v1/auth/sign-in',
    '/api/v1/auth/sign-up',
    '/api/v1/auth/sign-out',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
    '/api/v1/auth/google',
    '/api/v1/auth/microsoft',
    '/api/v1/eula/content',
    '/api/v1/eula/check',
    '/api/v1/eula/sign'
];
/**
 * Global middleware to check EULA on all protected routes
 * Add this after your auth middleware
 */
const globalEulaCheck = (req, res, next) => {
    // Skip EULA check for exempt routes
    if (exports.EULA_EXEMPT_ROUTES.some(route => req.path.startsWith(route))) {
        return next();
    }
    // Skip EULA check for public routes (non-authenticated requests)
    const user = req.user;
    if (!user || !user._id) {
        return next();
    }
    // Apply EULA requirement
    (0, exports.requireEulaAcceptance)(req, res, next);
};
exports.globalEulaCheck = globalEulaCheck;
//# sourceMappingURL=eula.middleware.js.map