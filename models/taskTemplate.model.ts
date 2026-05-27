// models/taskTemplate.model.ts
import mongoose, { Schema, Document } from 'mongoose';

interface ITaskTemplate extends Document {
  type: 'project' | 'projectSite';
  tasks: Array<{
    fieldName: string;
    dataType: string;
    description?: string;
    userFacingCopy?: string;
    fieldLabel?: string;
    helperText?: string;
    hoverText?: string;
    isRequired: boolean;
    sortOrder?: number;
    step?: number;
    stepNumber?: number;
    stepLabel?: string;
    conditionalOn?: { fieldName: string; value: any };
    options?: string[];
  }>;
  version: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taskTemplateSchema = new Schema<ITaskTemplate>({
  type: {
    type: String,
    enum: ['project', 'projectSite'],
    required: true
  },
  tasks: [
    {
      fieldName: String,
      dataType: String,
      description: String,
      userFacingCopy: String,
      fieldLabel: String,
      helperText: String,
      hoverText: String,
      isRequired: Boolean,
      sortOrder: Number,
      step: Number,
      stepNumber: Number,
      stepLabel: String,
      conditionalOn: {
        fieldName: String,
        value: mongoose.Schema.Types.Mixed
      },
      options: [String]
    }
  ],
  version: {
    type: String,
    default: '1.0.0'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const TaskTemplate = mongoose.models.TaskTemplate || 
                     mongoose.model<ITaskTemplate>('TaskTemplate', taskTemplateSchema);

export default TaskTemplate;