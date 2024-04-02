const mongoose = require('mongoose');

const { Schema } = mongoose;

const LeaveLogSchema = new Schema(
  {
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveType',
    },
    leaveGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'LeaveGroup',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    startAt: {
      type: String,
      default: 'AM',
    },
    endAt: {
      type: String,
      default: 'AM',
    },
    totalDay: {
      type: Number,
      default: 0,
    },
    totalDeducated: {
      type: Number,
      default: 0,
    },
    totalRestOff: {
      type: Number,
      default: 0,
    },
    remark: {
      type: String,
    },
    timeZone: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isAllocated: {
      type: Boolean,
      default: false,
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    attachment: {
      type: String,
    },
    status: {
      type: Number,
      default: 0, // 0 pending, 1 approve, 2 reject,3 allocated, 4 balloted,
      // 5 cancelled, 7 - apply leave submitted with date change
      // 8 approved //9 rejected
    },
    isChangeDate: {
      type: Boolean,
      default: false,
    },
    changeDateHistory: [
      {
        changeBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        oldData: {
          type: Object,
        },
        changedDateTime: {
          type: Date,
        },
      },
    ],
    isSwappable: {
      type: Number,
      default: 1, // 1 yes, 2 NO
    },
    isBalloted: {
      type: Boolean,
      default: false,
    },
    submittedFrom: {
      type: Number,
      default: 0, // 1 approve, 2 reject,3 allocated, 4 balloted
    },
    approvalHistory: [
      {
        approvalBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        approvalDateTime: {
          type: Date,
        },
        approvalRemark: {
          type: String,
        },
        approvalFrom: {
          type: Number,
        },
        status: {
          type: Number, // 1 approve, 2 reject
        },
      },
    ],
    isAutoApproved: {
      type: Boolean,
      default: false,
    },
    isSwapRequestSent: {
      type: Boolean,
      default: false,
    },

    isSwapRequestReceived: {
      type: Boolean,
      default: false,
    },
    isSwapAccepted: {
      type: Number,
      default: 0, // 1 yes 2 no
    },
    swapLogId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SwapLog',
      },
    ],
    sentSwapLogId: {
      type: Schema.Types.ObjectId,
      ref: 'SwapLog',
    },
    lastSwapId: {
      type: Schema.Types.ObjectId,
      ref: 'SwapLog',
    },
    isQuotaCheck: {
      type: Boolean,
      default: true,
    },
    isSender: {
      type: Number,
      default: 0, // 0 none, 1 sender
      // not in used as of now :- 3 sender approve, 4 receiver approve, 5 sender reject, 6 receiver reject
    },
    isReceiver: {
      type: Number,
      default: 0, // 0 none, 1 receiver,
      // not in used as of now :- 3 sender approve, 4 receiver approve, 5 sender reject, 6 receiver reject
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledDateTime: {
      type: Date,
    },
    oldDates: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
LeaveLogSchema.index({ userId: 1 });

module.exports = mongoose.model('LeaveLog', LeaveLogSchema);
