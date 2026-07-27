"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/riskChangeLog.model.ts
const mongoose_1 = __importStar(require("mongoose"));
// ============================================================================
// SCHEMA DEFINITION
// ============================================================================
const changeDetailSchema = new mongoose_1.Schema({
    field: {
        type: String,
        required: true
    },
    fieldLabel: {
        type: String,
        required: true
    },
    oldValue: mongoose_1.Schema.Types.Mixed,
    newValue: mongoose_1.Schema.Types.Mixed,
    oldValueLabel: String,
    newValueLabel: String
}, { _id: false });
const riskChangeLogSchema = new mongoose_1.Schema({
    riskId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'RiskRegister',
        required: true,
        index: true
    },
    project: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    changeType: {
        type: String,
        enum: ['status', 'assessment', 'mitigation', 'review', 'ownership', 'source', 'general'],
        required: true,
        index: true
    },
    changedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    changedAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
    },
    changes: [changeDetailSchema],
    description: {
        type: String,
        maxlength: 500
    },
    impact: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
    },
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true,
    collection: 'riskchangelogs'
});
// ============================================================================
// INDEXES
// ============================================================================
riskChangeLogSchema.index({ riskId: 1, changedAt: -1 });
riskChangeLogSchema.index({ project: 1, changeType: 1, changedAt: -1 });
riskChangeLogSchema.index({ organization: 1, changedAt: -1 });
riskChangeLogSchema.index({ changedBy: 1, changedAt: -1 });
// ============================================================================
// STATIC METHODS
// ============================================================================
riskChangeLogSchema.statics.logChange = function (riskId_1, project_1, organization_1, changeType_1, changedBy_1, changes_1, description_1) {
    return __awaiter(this, arguments, void 0, function* (riskId, project, organization, changeType, changedBy, changes, description, impact = 'low') {
        return yield this.create({
            riskId,
            project,
            organization,
            changeType,
            changedBy,
            changes,
            description,
            impact,
            changedAt: new Date()
        });
    });
};
riskChangeLogSchema.statics.findByRisk = function (riskId, limit = 50) {
    return this.find({ riskId })
        .populate('changedBy', 'name email')
        .sort({ changedAt: -1 })
        .limit(limit)
        .exec();
};
riskChangeLogSchema.statics.findByProject = function (projectId, startDate, endDate) {
    const query = { project: projectId };
    if (startDate || endDate) {
        query.changedAt = {};
        if (startDate)
            query.changedAt.$gte = startDate;
        if (endDate)
            query.changedAt.$lte = endDate;
    }
    return this.find(query)
        .populate('changedBy', 'name email')
        .populate('riskId', 'name riskScore')
        .sort({ changedAt: -1 })
        .exec();
};
riskChangeLogSchema.statics.getChangeStats = function (projectId, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const matchStage = { project: projectId };
        if (startDate || endDate) {
            matchStage.changedAt = {};
            if (startDate)
                matchStage.changedAt.$gte = startDate;
            if (endDate)
                matchStage.changedAt.$lte = endDate;
        }
        return yield this.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$changeType',
                    count: { $sum: 1 },
                    highImpact: {
                        $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] }
                    }
                }
            },
            { $sort: { count: -1 } }
        ]);
    });
};
// ============================================================================
// INSTANCE METHODS
// ============================================================================
riskChangeLogSchema.methods.toDisplayFormat = function () {
    return {
        id: this._id.toString(),
        riskId: this.riskId.toString(),
        changeType: this.changeType,
        changedBy: this.changedBy,
        changedAt: this.changedAt,
        description: this.description || this.generateDescription(),
        impact: this.impact,
        changes: this.changes
    };
};
riskChangeLogSchema.methods.generateDescription = function () {
    if (!this.changes || this.changes.length === 0)
        return 'No changes recorded';
    if (this.changes.length === 1) {
        const change = this.changes[0];
        const oldLabel = change.oldValueLabel || String(change.oldValue || 'None');
        const newLabel = change.newValueLabel || String(change.newValue || 'None');
        return `${change.fieldLabel} changed from "${oldLabel}" to "${newLabel}"`;
    }
    if (this.changes.length === 2) {
        return `${this.changes[0].fieldLabel} and ${this.changes[1].fieldLabel} updated`;
    }
    return `${this.changes.length} fields updated: ${this.changes.map((c) => c.fieldLabel).join(', ')}`;
};
// ============================================================================
// MODEL EXPORT
// ============================================================================
const RiskChangeLog = mongoose_1.default.model('RiskChangeLog', riskChangeLogSchema);
exports.default = RiskChangeLog;
//# sourceMappingURL=riskChangeLog.model.js.map