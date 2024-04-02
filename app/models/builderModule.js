const mongoose = require('mongoose');

const { Schema } = mongoose;

const BuilderModuleSchema = new Schema(
  {
    moduleName: {
      type: String,
      default: '',
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    viewCount: {
      type: Number,
      default: 0,
    },
    welComeMessage: {
      type: String,
      default: '',
    },
    welComeAttachement: {
      type: String,
      default: '',
    },
    closingMessage: {
      type: String,
      default: '',
    },
    randomOrder: {
      type: Boolean,
      default: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Number,
      default: 0, // 0 - Draft, 1-Active, 2-Inactive
    },
    postSubmissionRequired: {
      type: Boolean,
      default: false,
    },
    postSubmissionMessage: {
      type: String,
      default: '',
    },
    postSubmissionImage: {
      type: String,
      default: '',
    },
    postSubmissionResponse: {
      type: Array,
    },
    mobileModule: {
      type: Number,
      default: 0,
    },
    scoringEnabled: {
      type: Boolean,
      default: false,
    },
    scorePerQuestion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
BuilderModuleSchema.index({ createdBy: 1, updatedAt: 1, companyId: 1 });

module.exports = mongoose.model('BuilderModule', BuilderModuleSchema);
