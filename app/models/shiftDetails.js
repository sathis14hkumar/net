const mongoose = require('mongoose');

const { Schema } = mongoose;

const ShiftDetailsSchema = new Schema(
  {
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
    },
    subSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSkillSet',
      },
    ],
    mainSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SkillSet',
      },
    ],
    skillSetTierType: {
      type: Number,
      default: 2,
    },
    totalStaffNeedCount: {
      type: Number,
      default: 0,
    },
    timeZone: {
      type: String,
      default: '+0800',
    },
    isLimit: {
      type: Boolean,
      default: false,
    },
    staffNeedCount: {
      type: Number,
      default: 0,
    },
    backUpStaffNeedCount: {
      type: Number,
      default: 0,
    },
    confirmedStaffs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    backUpStaffs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    backUpStaffNeedCountLog: {
      type: Number,
      default: 0,
    },
    backUpStaffsLog: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    cancelledStaffs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    appliedStaffs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AppliedStaff',
      },
    ],
    date: {
      type: Date,
    },
    day: {
      type: String,
      default: '',
    },
    startTime: {
      type: Date,
    },
    /*  */
    endTime: {
      type: Date,
    },
    startTimeInSeconds: {
      type: Number,
    },
    endTimeInSeconds: {
      type: Number,
    },
    duration: {
      type: Number,
      default: 0,
    },
    reportLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'ReportingLocation',
    },
    dedicatedRequestTo: {
      /* for request shift to particular flexistaff user */
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    requestedShifts: [
      {
        // newly requested shiftDetails id
        type: Schema.Types.ObjectId,
        ref: 'ShiftDetails',
      },
    ],
    referenceShiftDetailsId: {
      /* source shiftDetails id where request got from */
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    isShortTimeCancel: {
      /* if 1 => then standby staffs will be asking to acknowledge to confirm according to respective cancellation  */
      type: Number,
      default: 0,
    },
    shortTimeRequestRecjectedFlexistaffs: {
      type: Array,
      default: [],
    },
    isShortTimeAdjust: {
      /* if 1 => then standby staffs will be asking to acknowledge to confirm according to respective cancellation  */
      type: Number,
      default: 0,
    },
    shortTimeAdjustRequestRecjectedFlexistaffs: {
      type: Array,
      default: [],
    },
    adjustedBy: [
      {
        increasedStaffCount: {
          type: Number,
          default: 0,
        },
        adjustedUserId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        minutesToShiftStartTime: {
          type: Number,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: new Date(),
        },
      },
    ],
    cancelledBy: [
      {
        isMedicalReason: {
          type: String,
          default: '',
        },
        otherReason: {
          type: String,
          default: '',
        },
        cancelledUserId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        minutesToShiftStartTime: {
          type: Number,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: new Date(),
        },
      },
    ],
    /* Shift Created from Requested Change */
    isRequested: {
      type: Boolean,
      default: false,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    requestedUsers: [
      {
        /* User getting notification */
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        shiftDetailsId: {
          type: Schema.Types.ObjectId,
          ref: 'ShiftDetails',
        },
        status: {
          /*  0 - pending , 1- accepted, 2- rejected */ type: Number,
          default: 0,
        },
      },
    ],
    currentReqShift: {
      /* source shiftDetails id where request got from */
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    activeStatus: {
      /* If any requested/adjust activity is processing  */ type: Boolean,
      default: false,
    },
    status: {
      type: Number,
      default: 0,
    },
    isExtendedShift: {
      type: Boolean,
      default: false,
    },
    isSplitShift: {
      type: Boolean,
      default: false,
    },
    isAssignShift: {
      type: Boolean,
      default: false,
    },
    draftId: {
      type: Schema.Types.ObjectId,
      ref: 'AssignShift',
    },
    extendedStaff: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        confirmStatus: {
          type: Number,
          default: 1, // 1 Pending, 2 accepted 3 rejected
        },
        startDateTime: {
          type: Date,
        },
        endDateTime: {
          type: Date,
        },
        duration: {
          type: Number,
        },
        isLimit: {
          type: Boolean,
          default: false,
        },
      },
    ],
    isOff: {
      type: Boolean,
      default: false,
    },
    isRest: {
      type: Boolean,
      default: false,
    },
    isRecalled: {
      type: Boolean,
      default: false,
    },
    isRecallAccepted: {
      type: Number,
      default: 1, // 1 2 3 not, confirmed declined
    },
    randomShiftId: { type: Schema.Types.ObjectId },
    isParent: { type: Number },
    geoReportingLocation: {
      type: Schema.Types.ObjectId,
      ref: 'geoReportingLocation',
    },
    proximity: {
      type: Number,
    },
    isCheckInEnabled: {
      type: Boolean,
    },
    isProximityEnabled: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
    usePushEach: true,
  },
);

// Indexes
ShiftDetailsSchema.index({ date: 1 });
ShiftDetailsSchema.index({ shiftId: 1 });
ShiftDetailsSchema.index({ startTime: 1 });
ShiftDetailsSchema.index({
  backUpStaffs: 1,
  status: 1,
  _id: 1,
  startTime: 1,
  endTime: 1,
});
ShiftDetailsSchema.index({
  confirmedStaffs: 1,
  status: 1,
  _id: 1,
  startTime: 1,
  endTime: 1,
});
ShiftDetailsSchema.index({ isParent: 1, randomShiftId: 1 });
const ShiftDetails = mongoose.model('ShiftDetails', ShiftDetailsSchema);

module.exports = ShiftDetails;
