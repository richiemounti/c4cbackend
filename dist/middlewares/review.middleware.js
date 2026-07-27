"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasReviewManagement = void 0;
/**
 * Middleware to check if user has review_management permission
 * This is a universal permission that grants access to review features
 */
const hasReviewManagement = () => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                const error = new Error('Authentication required');
                error.statusCode = 401;
                throw error;
            }
            // Check if user has review_management permission
            const hasPermission = req.user.hasPermission('review_management');
            if (!hasPermission) {
                const error = new Error('Review management permission required');
                error.statusCode = 403;
                throw error;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
};
exports.hasReviewManagement = hasReviewManagement;
//# sourceMappingURL=review.middleware.js.map