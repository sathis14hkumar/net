const mongoose = require('mongoose');

const { Schema } = mongoose;

const PrivilegeSchema = new Schema(
  {
    privilegeCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'PrivilegeCategory',
    },
    name: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    additionalAccessRights: {
      type: String,
      default: '',
    },
    flags: {
      createUser: {
        type: Boolean,
        default: false,
      },
      editUser: {
        type: Boolean,
        default: false,
      },
      viewUser: {
        type: Boolean,
        default: false,
      },
      skillSetSetup: {
        type: Boolean,
        default: false,
      },
      businessUserSetup: {
        type: Boolean,
        default: false,
      },
      roleSetup: {
        type: Boolean,
        default: false,
      },
      setTemplate: {
        type: Boolean,
        default: false,
      },
      inputWeeklyStaffing: {
        type: Boolean,
        default: false,
      },
      planShift: {
        type: Boolean,
        default: false,
      },
      viewShift: {
        type: Boolean,
        default: false,
      },
      adjustShift: {
        type: Boolean,
        default: false,
      },
      makeShiftBooking: {
        type: Boolean,
        default: false,
      },
      myBooking: {
        type: Boolean,
        default: false,
      },
      viewBooking: {
        type: Boolean,
        default: false,
      },
      requestBooking: {
        type: Boolean,
        default: false,
      },
      inputNotification: {
        type: Boolean,
        default: false,
      },
      viewNotification: {
        type: Boolean,
        default: false,
      },
      reports: {
        type: Boolean,
        default: false,
      },
      submitFeedback: {
        type: Boolean,
        default: false,
      },
      // version 2 privileges
      userProfile: {
        type: Boolean,
        default: false,
      },
      channelSetup: {
        type: Boolean,
        default: false,
      },
      cancelShift: {
        type: Boolean,
        default: false,
      },
      centralBuilder: {
        type: Boolean,
        default: false,
      },
      manageNews: {
        type: Boolean,
        default: false,
      },
      manageEvents: {
        type: Boolean,
        default: false,
      },
      newsAndEvents: {
        type: Boolean,
        default: false,
      },
      myBoards: {
        type: Boolean,
        default: false,
      },
      lockedAccount: {
        type: Boolean,
        default: false,
      },
      setUpForm: {
        type: Boolean,
        default: false,
      },
      myForm: {
        type: Boolean,
        default: false,
      },
      facialCreation: {
        type: Boolean,
        default: false,
      },
      externalLink: {
        type: Boolean,
        default: false,
      },
      shiftExtension: {
        type: Boolean,
        default: false,
      },
      shiftscheme: {
        type: Boolean,
        default: false,
      },
      timesheet: {
        type: Boolean,
        default: false,
      },
      staffView: {
        type: Boolean,
        default: false,
      },
      approveTimesheet: {
        type: Boolean,
        default: false,
      },
      viewTimesheet: {
        type: Boolean,
        default: false,
      },
      editTimesheetAfterLock: {
        type: Boolean,
        default: false,
      },
      resetPassword: {
        type: Boolean,
        default: false,
      },
      myRewards: {
        type: Boolean,
        default: false,
      },
      redemptionList: {
        type: Boolean,
        default: false,
      },
      rewardsSettings: {
        type: Boolean,
        default: false,
      },
      challenges: {
        type: Boolean,
        default: false,
      },
      challengesWeb: {
        type: Boolean,
        default: false,
      },
      myPage: {
        type: Boolean,
        default: false,
      },
      integration: {
        type: Boolean,
        default: false,
      },
      employeeDirectory: {
        type: Boolean,
        default: false,
      },
      setupOPSGroup: {
        type: Boolean,
        default: false,
      },
      viewOPSGroup: {
        type: Boolean,
        default: false,
      },
      createEditOPSGroup: {
        type: Boolean,
        default: false,
      },
      assignAdminLeaveBallot: {
        type: Boolean,
        default: false,
      },
      viewBallot: {
        type: Boolean,
        default: false,
      },
      createEditBallot: {
        type: Boolean,
        default: false,
      },
      createOPSGroup: {
        type: Boolean,
        default: false,
      },
      leavePlannerApprover: {
        type: Boolean,
        default: false,
      },
      leavePlannerMobile: {
        type: Boolean,
        default: false,
      },
      leavePlannerAdditionalViewMobileApp: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PrivilegeSchema.index({ flags: 1 });

const Privilege = mongoose.model('Privilege', PrivilegeSchema);

module.exports = Privilege;
