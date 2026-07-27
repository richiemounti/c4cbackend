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
exports.getSignatureStatistics = exports.revokeSignature = exports.getAllSignatures = exports.getSignatureHistory = exports.getEulaContent = exports.signEula = exports.checkEulaStatus = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const eulaSignature_model_1 = __importDefault(require("../models/eulaSignature.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
// Current EULA version - update this when EULA changes
const CURRENT_EULA_VERSION = "v3-16.06.2025";
// Helper function to get client IP
const getClientIP = (req) => {
    var _a, _b, _c;
    return ((_c = (req.headers['x-forwarded-for'] ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        ((_b = (_a = req.connection) === null || _a === void 0 ? void 0 : _a.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress) ||
        req.ip ||
        'unknown')) === null || _c === void 0 ? void 0 : _c.toString().split(',')[0]) || 'unknown';
};
/**
 * Check if user has signed the current EULA
 * @route GET /api/v1/eula/check
 * @access Private
 */
const checkEulaStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user._id;
        if (!userId) {
            const error = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has signed current EULA
        const hasSigned = yield eulaSignature_model_1.default.hasUserSignedCurrentEula(userId, CURRENT_EULA_VERSION);
        // Get latest signature if exists
        const latestSignature = yield eulaSignature_model_1.default.getUserLatestSignature(userId);
        res.status(200).json({
            success: true,
            data: {
                hasSignedCurrent: hasSigned,
                currentVersion: CURRENT_EULA_VERSION,
                latestSignature: latestSignature ? {
                    version: latestSignature.eulaVersion,
                    signedAt: latestSignature.signedAt,
                    isActive: latestSignature.isActive
                } : null,
                requiresSignature: !hasSigned
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkEulaStatus = checkEulaStatus;
/**
 * Sign the EULA
 * @route POST /api/v1/eula/sign
 * @access Private
 */
const signEula = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user._id;
        const { fullName, email, position, organization, acceptedTerms } = req.body;
        if (!userId) {
            const error = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }
        // Validate required fields
        if (!fullName || !email || !acceptedTerms) {
            const error = new Error('Full name, email, and terms acceptance are required');
            error.statusCode = 400;
            throw error;
        }
        if (!acceptedTerms) {
            const error = new Error('You must accept the terms and conditions');
            error.statusCode = 400;
            throw error;
        }
        // Get user to validate email
        const user = yield user_model_1.default.findById(userId);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        // Validate email matches user's email
        if (user.email.toLowerCase() !== email.toLowerCase()) {
            const error = new Error('Email must match your account email');
            error.statusCode = 400;
            throw error;
        }
        // Check if user has already signed current EULA
        const existingSignature = yield eulaSignature_model_1.default.findOne({
            user: userId,
            eulaVersion: CURRENT_EULA_VERSION,
            isActive: true
        });
        if (existingSignature) {
            const error = new Error('You have already signed the current EULA');
            error.statusCode = 409;
            throw error;
        }
        // Get client information
        const ipAddress = getClientIP(req);
        const userAgent = req.headers['user-agent'] || 'unknown';
        // Create new signature
        const signature = new eulaSignature_model_1.default({
            user: userId,
            eulaVersion: CURRENT_EULA_VERSION,
            signedAt: new Date(),
            ipAddress,
            userAgent,
            signatureData: {
                fullName: fullName.trim(),
                email: email.toLowerCase().trim(),
                position: (position === null || position === void 0 ? void 0 : position.trim()) || undefined,
                organization: (organization === null || organization === void 0 ? void 0 : organization.trim()) || undefined
            },
            isActive: true
        });
        yield signature.save();
        // Populate user information for response
        yield signature.populate('user', 'name email userName');
        res.status(201).json({
            success: true,
            message: 'EULA signed successfully',
            data: {
                signature: {
                    _id: signature._id,
                    version: signature.eulaVersion,
                    signedAt: signature.signedAt,
                    signatureData: signature.signatureData
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.signEula = signEula;
/**
 * Get current EULA content and version
 * @route GET /api/v1/eula/content
 * @access Public
 */
const getEulaContent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // In a real application, you might store EULA content in the database
        // For now, we'll return the version and indicate where to find the content
        res.status(200).json({
            success: true,
            data: {
                version: CURRENT_EULA_VERSION,
                title: "Value Scope End User Licence Agreement",
                lastUpdated: "June 2025",
                contentUrl: "/terms", // Frontend route where full content is displayed
                summary: "End User Licence Agreement for the Value Scope platform by ConnectGo Ltd."
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getEulaContent = getEulaContent;
/**
 * Get user's signature history
 * @route GET /api/v1/eula/history
 * @access Private
 */
const getSignatureHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user._id;
        if (!userId) {
            const error = new Error('User not authenticated');
            error.statusCode = 401;
            throw error;
        }
        const signatures = yield eulaSignature_model_1.default.find({ user: userId })
            .sort({ signedAt: -1 })
            .select('-userAgent -ipAddress') // Exclude sensitive data
            .populate('user', 'name email userName');
        res.status(200).json({
            success: true,
            count: signatures.length,
            data: signatures
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSignatureHistory = getSignatureHistory;
/**
 * Admin: Get all signatures (with pagination)
 * @route GET /api/v1/eula/admin/signatures
 * @access Private (Admin only)
 */
const getAllSignatures = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        // Check if user is ConnectGo staff
        if (!user.isConnectGoStaff) {
            const error = new Error('Access denied. Admin privileges required.');
            error.statusCode = 403;
            throw error;
        }
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        // Build filter
        const filter = {};
        if (req.query.version) {
            filter.eulaVersion = req.query.version;
        }
        if (req.query.isActive !== undefined) {
            filter.isActive = req.query.isActive === 'true';
        }
        // Get signatures with pagination
        const signatures = yield eulaSignature_model_1.default.find(filter)
            .sort({ signedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('user', 'name email userName')
            .populate('revokedBy', 'name email');
        const total = yield eulaSignature_model_1.default.countDocuments(filter);
        res.status(200).json({
            success: true,
            count: signatures.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            data: signatures
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAllSignatures = getAllSignatures;
/**
 * Admin: Revoke a signature
 * @route PUT /api/v1/eula/admin/signatures/:id/revoke
 * @access Private (Admin only)
 */
const revokeSignature = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const signatureId = req.params.id;
        const { reason } = req.body;
        // Check if user is ConnectGo staff
        if (!user.isConnectGoStaff) {
            const error = new Error('Access denied. Admin privileges required.');
            error.statusCode = 403;
            throw error;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(signatureId)) {
            const error = new Error('Invalid signature ID');
            error.statusCode = 400;
            throw error;
        }
        const signature = yield eulaSignature_model_1.default.findById(signatureId);
        if (!signature) {
            const error = new Error('Signature not found');
            error.statusCode = 404;
            throw error;
        }
        if (!signature.isActive) {
            const error = new Error('Signature is already revoked');
            error.statusCode = 400;
            throw error;
        }
        // Revoke signature
        yield signature.revoke(user._id, reason || 'Revoked by administrator');
        res.status(200).json({
            success: true,
            message: 'Signature revoked successfully',
            data: signature
        });
    }
    catch (error) {
        next(error);
    }
});
exports.revokeSignature = revokeSignature;
/**
 * Get signature statistics
 * @route GET /api/v1/eula/admin/statistics
 * @access Private (Admin only)
 */
const getSignatureStatistics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        // Check if user is ConnectGo staff
        if (!user.isConnectGoStaff) {
            const error = new Error('Access denied. Admin privileges required.');
            error.statusCode = 403;
            throw error;
        }
        const [totalSignatures, activeSignatures, currentVersionSignatures, revokedSignatures, uniqueUsers] = yield Promise.all([
            eulaSignature_model_1.default.countDocuments(),
            eulaSignature_model_1.default.countDocuments({ isActive: true }),
            eulaSignature_model_1.default.countDocuments({
                eulaVersion: CURRENT_EULA_VERSION,
                isActive: true
            }),
            eulaSignature_model_1.default.countDocuments({ isActive: false }),
            eulaSignature_model_1.default.distinct('user', { isActive: true })
        ]);
        // Get signatures by version
        const signaturesByVersion = yield eulaSignature_model_1.default.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$eulaVersion', count: { $sum: 1 } } },
            { $sort: { '_id': -1 } }
        ]);
        // Get recent signatures (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentSignatures = yield eulaSignature_model_1.default.countDocuments({
            signedAt: { $gte: thirtyDaysAgo },
            isActive: true
        });
        res.status(200).json({
            success: true,
            data: {
                total: totalSignatures,
                active: activeSignatures,
                currentVersion: currentVersionSignatures,
                revoked: revokedSignatures,
                uniqueUsers: uniqueUsers.length,
                recentSignatures,
                signaturesByVersion,
                currentEulaVersion: CURRENT_EULA_VERSION
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSignatureStatistics = getSignatureStatistics;
//# sourceMappingURL=eula.controller.js.map