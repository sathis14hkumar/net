const mongoose = require('mongoose');

const { Schema } = mongoose;
// 28 field
const AssignShiftSchema = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    staffId: {
      type: String,
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    schemeDetails: {
      type: Object,
    },
    alertMessage: {
      type: String,
    },
    isOff: {
      type: Boolean,
      default: false,
    },
    isRest: {
      type: Boolean,
      default: false,
    },
    isLimit: {
      type: Boolean,
      default: false,
    },
    isAlert: {
      type: Boolean,
      default: false,
    },
    isAllowPublish: {
      type: Boolean,
      default: true,
    },
    draftStatus: {
      type: Number,
      default: 0, // not publish // 1 publish
    },
    staffRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
    },
    isSplitShift: {
      type: Boolean,
      default: false,
    },
    staffAppointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    shiftRead: {
      type: Number,
      default: 0, // 0 not view // 1 view
    },
    timeZone: {
      type: String,
      default: '+0800',
    },
    shiftChangeRequestMessage: {
      type: String,
      default: '',
    },
    shiftChangeRequestStatus: {
      type: Number,
      default: 0, // 0 not genereate // 1 genereated // 2 accept // 3 reject
    },
    weekNumber: {
      type: Number,
      default: 0,
    },
    weekRangeStartsAt: {
      type: Date,
    },
    weekRangeEndsAt: {
      type: Date,
    },
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Number,
      default: 0, // 0 in used // 1 deleted
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
      default: 1,
    },
    staffNeedCount: {
      type: Number,
      default: 1,
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
    splitStartTime: {
      type: Date,
    },
    /*  */
    splitEndTime: {
      type: Date,
    },
    startTimeInSeconds: {
      type: Number,
    },
    endTimeInSeconds: {
      type: Number,
    },
    splitStartTimeInSeconds: {
      type: Number,
    },
    splitEndTimeInSeconds: {
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
    reportLocationName: {
      type: String,
    },
    shiftDetailId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    isRecalled: {
      type: Boolean,
      default: false,
    },
    isRecallAccepted: {
      type: Number,
      default: 0, // 1 2 3 not, confirmed declined
    },
    isEmpty: {
      type: Boolean,
      default: false,
    },
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
  },
);

// Indexes
AssignShiftSchema.index({ businessUnitId: 1, weekRangeStartsAt: 1 });
AssignShiftSchema.index({ staffId: 1, date: 1 });
AssignShiftSchema.index({ staff_id: 1, date: 1 });
AssignShiftSchema.index({ weekNumber: 1, staff_id: 1 });

module.exports = mongoose.model('AssignShift', AssignShiftSchema);
