const mongoose = require('mongoose');

const { Schema } = mongoose;

const manageFormLog = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    manageFormId: {
      type: Schema.Types.ObjectId,
      ref: 'ManageForm',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    changeMessage: {
      type: String,
      default: '',
    },
    staffId: {
      type: String,
      default: '',
    },
    userName: {
      type: String,
      default: '',
    },
    changeType: {
      type: Number,
      enum: [1, 2], // 1:status change 2:questions change
    },
    oldData: [
      {
        type: Schema.Types.Mixed,
        default: '',
      },
    ],
    newData: [
      {
        type: Schema.Types.Mixed,
        default: '',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
manageFormLog.index({ companyId: 1 });
manageFormLog.index({ createdAt: 1 });
manageFormLog.index({ manageFormId: 1 });

module.exports = mongoose.model('ManageFormLog', manageFormLog);
