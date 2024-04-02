const mongoose = require('mongoose');

const { Schema } = mongoose;

const LeaveGroupSchema = new Schema(
  {
    name: {
      type: String,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    leaveType: [
      {
        leaveTypeId: {
          type: Schema.Types.ObjectId,
          ref: 'LeaveType',
        },
        quota: {
          type: Number,
        },
        displayQuota: {
          type: Boolean,
          default: false,
        },
        isSpecialType: {
          type: Boolean,
          default: false,
        },
        proRate: [
          {
            fromMonth: {
              type: Number,
            },
            toMonth: {
              type: Number,
            },
            quota: {
              type: Number,
              default: 0,
            },
          },
        ],
        seniority: [
          {
            year: {
              type: Number,
            },
            quota: {
              type: Number,
              default: 0,
            },
          },
        ],
        displayInMyLeave: {
          type: Boolean,
          default: false,
        },
        leavePlanning: {
          isLeaveRequest: {
            type: Boolean,
            default: false,
          },
          isAdminAllocate: {
            type: Boolean,
            default: false,
          },
        },
        leaveApplication: {
          isApplyLeavePlan: {
            type: Boolean,
            default: false,
          },
          isApplyLeave: {
            type: Boolean,
            default: false,
          },
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    adminId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
LeaveGroupSchema.index({ companyId: 1, name: 'text' });

module.exports = mongoose.model('LeaveGroup', LeaveGroupSchema);
