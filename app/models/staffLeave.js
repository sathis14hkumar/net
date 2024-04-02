const mongoose = require('mongoose');

const { Schema } = mongoose;

const StaffLeaveSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    leaveGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveGroup',
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    leaveDetails: [
      {
        year: {
          type: Number,
          default: new Date().getFullYear(),
        },
        leaveTypeId: {
          type: Schema.Types.ObjectId,
          ref: 'LeaveType',
        },
        quota: {
          type: Number,
          default: 0,
          // taken = total -quota 20-17 = 3 is the taken
        },
        planQuota: {
          type: Number,
          default: 0,
          // request = total -planQuota 20-15 = 5 is the requested
        },
        planDymanicQuota: {
          type: Number,
          default: 0, // this is same as quota for front end it plan
        },
        total: {
          type: Number,
          default: 0,
        },
        taken: {
          type: Number,
          default: 0,
        },
        request: {
          type: Number,
          default: 0,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
StaffLeaveSchema.index({ userId: 1 });
module.exports = mongoose.model('StaffLeave', StaffLeaveSchema);
