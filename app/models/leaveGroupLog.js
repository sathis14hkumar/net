const mongoose = require('mongoose');

const { Schema } = mongoose;

const LeaveGroupLogSchema = new Schema(
  {
    leaveGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveType',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    change: {
      type: Object,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('LeaveGroupLog', LeaveGroupLogSchema);
