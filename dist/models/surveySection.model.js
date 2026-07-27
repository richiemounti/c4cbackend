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
// models/surveySection.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const surveySectionSchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: [true, 'Section title is required'],
        trim: true,
        minLength: 2,
        maxLength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    survey: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    order: {
        type: Number,
        required: true,
        default: 0
    },
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
// Pre-save hook to ensure orders are sequential
surveySectionSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isNew && this.order === 0) {
            try {
                const SurveySectionModel = mongoose_1.default.model('SurveySection');
                const highestOrder = yield SurveySectionModel.findOne({ survey: this.survey })
                    .sort('-order')
                    .exec();
                if (highestOrder) {
                    this.order = highestOrder.order + 1;
                }
                else {
                    this.order = 1;
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    return next(error);
                }
                return next(new Error('Unknown error occurred'));
            }
        }
        next();
    });
});
const SurveySection = mongoose_1.default.model('SurveySection', surveySectionSchema);
exports.default = SurveySection;
//# sourceMappingURL=surveySection.model.js.map