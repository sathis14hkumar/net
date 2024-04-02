const mongoose = require('mongoose');

const { Schema } = mongoose;

const PageSettingSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    buTemplateId: {
      type: Schema.Types.ObjectId,
      ref: 'BuTemplate',
    },
    bannerImages: {
      type: Array,
      default: [],
    },
    isTaskViewIncluded: {
      type: Boolean,
      default: false,
    },
    isChallengeIncluded: {
      type: Boolean,
      default: false,
    },
    isFormsIncluded: {
      type: Boolean,
      default: false,
    },
    isBoardsIncluded: {
      type: Boolean,
      default: false,
    },
    quickLinks: {
      type: Array,
      default: [],
    },
    externalLinks: {
      type: Array,
      default: [],
    },
    loginFields: [
      {
        type: Schema.Types.ObjectId,
        ref: 'UserField',
      },
    ],
    pwdSettings: {
      status: {
        type: Number,
        default: 0,
      },
      charLength: {
        type: Number,
        default: 0,
      },
      charTypes: {
        lowerCase: {
          type: Boolean,
          default: false,
        },
        upperCase: {
          type: Boolean,
          default: false,
        },
        numbers: {
          type: Boolean,
          default: false,
        },
        specialChar: {
          type: Boolean,
          default: false,
        },
      },
      pwdDuration: {
        type: Number,
        default: 0,
      },
      pwdReUse: {
        type: Number,
        default: 0,
      },
      maxLoginAttempt: {
        type: Number,
        default: 0,
      },
      passwordType: {
        type: Number,
        default: 1,
        enum: [1, 2] /** 1: System generated password 2. Default Password */,
      },
      defaultPassword: {
        type: String,
      },
      otpSentFor: {
        type: Number,
        default: 1,
        enum: [1, 2] /** 1. Email 2.Mobile */,
      },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Number,
      default: 0, // 1-Active, 2-Inactive
    },
    opsGroup: {
      blockLeaveConfiguration: {
        type: Number,
        default: 1,
      },
      slotType: {
        type: Number,
        default: 1,
      },
      leaveAdjust: {
        type: Boolean,
        default: false,
      },
      minWeeksBeforeSwop: {
        type: Number,
        default: 1,
      },
      tierType: {
        type: Number,
        default: 1, // 1 tier 1  2 tier
      },
      isStaffCanCancel: {
        type: Boolean,
        default: false,
      },
      isStaffCanCancelPlan: {
        type: Boolean,
        default: false,
      },
      staffCutOffTime: {
        type: Number,
      },
      isAdminCanCancel: {
        type: Boolean,
        default: false,
      },
      isAdminCanCancelPlan: {
        type: Boolean,
        default: false,
      },
      adminCutOffTime: {
        type: Number,
      },
      adminAllocateCutOffTime: {
        type: Number,
      },
      isadminCanChange: {
        type: Boolean,
        default: false,
      },
      isAdminCanChangePlan: {
        type: Boolean,
        default: false,
      },
      adminChangeCutOffTime: {
        type: Number,
      },
      swapMinimumWeek: {
        type: Number,
      },
    },
    compliments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Wall',
      },
    ],
    suggestions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Wall',
      },
    ],
    pointSystems: [
      {
        icon: {
          type: String,
        },
        title: {
          type: String,
        },
        description: {
          type: String,
        },
        isEnabled: {
          type: Boolean,
        },
      },
    ],
    notificRemindDays: {
      type: String,
    },
    notificRemindHours: {
      type: String,
    },
    adminEmail: {
      type: String,
      default: '',
    },
    techEmail: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PageSettingSchema.index({ companyId: 1 });

module.exports = mongoose.model('pageSetting', PageSettingSchema);
