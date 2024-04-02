const mongoose = require('mongoose');

const { Schema } = mongoose;

const LeaveTypeSchema = new Schema(
  {
    name: {
      type: String,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    isQuotaExceed: {
      type: Boolean,
      default: false,
    },
    isBallotAllowed: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      default: 'default',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
LeaveTypeSchema.index({ companyId: 1, name: 'text' });

module.exports = mongoose.model('LeaveType', LeaveTypeSchema);
