"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProfile = exports.validateChangePassword = exports.validateResetPassword = exports.validateForgotPassword = exports.validateSignIn = exports.validateSignUp = void 0;
const express_validator_1 = require("express-validator");
// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 400;
        error.data = errors.array(); // Store validation errors in data property
        throw error;
    }
    next();
};
// Sign Up validation
exports.validateSignUp = [
    (0, express_validator_1.body)('userName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
    (0, express_validator_1.body)('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (0, express_validator_1.body)('role')
        .optional()
        .isIn(['owner', 'admin', 'accountManager', 'manager', 'projectCreator', 'organiser', 'reviewer', 'fieldAgent'])
        .withMessage('Invalid role specified'),
    (0, express_validator_1.body)('organizationId')
        .optional()
        .isMongoId()
        .withMessage('Invalid organization ID format'),
    handleValidationErrors
];
// Sign In validation
exports.validateSignIn = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];
// Forgot Password validation
exports.validateForgotPassword = [
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    handleValidationErrors
];
// Reset Password validation
exports.validateResetPassword = [
    (0, express_validator_1.body)('token')
        .notEmpty()
        .withMessage('Reset token is required')
        .isLength({ min: 10 })
        .withMessage('Invalid token format'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    handleValidationErrors
];
// Change Password validation (for authenticated users)
exports.validateChangePassword = [
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (0, express_validator_1.body)('confirmPassword')
        .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Password confirmation does not match new password');
        }
        return true;
    }),
    handleValidationErrors
];
// Update Profile validation
exports.validateUpdateProfile = [
    (0, express_validator_1.body)('userName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Username must be between 2 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
    (0, express_validator_1.body)('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    (0, express_validator_1.body)('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    handleValidationErrors
];
exports.default = {
    validateSignUp: exports.validateSignUp,
    validateSignIn: exports.validateSignIn,
    validateForgotPassword: exports.validateForgotPassword,
    validateResetPassword: exports.validateResetPassword,
    validateChangePassword: exports.validateChangePassword,
    validateUpdateProfile: exports.validateUpdateProfile
};
//# sourceMappingURL=validation.auth.middleware.js.map