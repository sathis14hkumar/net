const mongoose = require('mongoose');

const { Schema } = mongoose;

const ChallengeLogSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    title: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    assignUsers: [
      {
        businessUnits: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSection',
          },
        ],
        buFilterType: {
          type: Number,
          default: 1, // 1.alluser 2.includeUser 3.excludeUser
        },
        appointments: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Appointment',
          },
        ],
        subSkillSets: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSkillSet',
          },
        ],
        user: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        admin: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        allBuToken: {
          type: Boolean,
          default: false,
        },
        customField: [],
      },
    ],
    isNotified: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      default: '',
    },
    leaderBoard: {
      type: Boolean,
      default: false,
    },
    publishStart: {
      type: Date,
      default: Date.now,
    },
    publishEnd: {
      type: Date,
      default: Date.now,
    },
    challengeStart: {
      type: Date,
      default: Date.now,
    },
    challengeEnd: {
      type: Date,
      default: Date.now,
    },
    selectedChannel: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    selectedCustomForm: {
      type: Schema.Types.ObjectId,
      ref: 'Customform',
    },
    selectedWall: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    criteriaType: {
      type: Number,
      /** 1: channel 2: Wall 3: System 4: Direct Rewards 5: Custom Form */
      enum: [1, 2, 3, 4, 5, 6],
      default: 1,
    },
    criteriaCategory: [
      {
        type: Schema.Types.Mixed,
        default: null,
      },
    ],
    nomineeQuestion: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
    },
    fieldOptions: [
      {
        fieldOptionValue: {
          type: Schema.Types.Mixed,
        },
        formStatusValue: {
          type: Schema.Types.Mixed,
        },
      },
    ],
    criteriaSourceType: {
      type: Number,
      /** 1: Reading Articles 2: Quessionalries, 3: Event attendence 4: Post Done 5: First Login */
      enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      default: 1,
    },
    criteriaCountType: {
      type: Number,
      /** 1:Single 2: Bundle */
      enum: [1, 2],
      default: 1,
    },
    criteriaCount: {
      type: Number,
      default: null,
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    stopAfterAchievement: {
      type: Boolean,
    },
    setLimitToMaxRewards: {
      type: Boolean,
    },
    maximumRewards: {
      type: Number,
      default: 0,
    },
    businessUnit: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    administrators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: Number,
      /*  0 - Draft , 1- Published, 2- Inactive */
      enum: [0, 1, 2],
      default: 0,
    },
    // createdBy: {
    //   type: Schema.Types.ObjectId,
    //   ref: "User"
    // },
    badgeTiering: {
      type: Boolean,
      default: false,
    },
    ranks: [
      {
        index: {
          type: Number,
        },
        name: {
          type: String,
        },
        startRange: {
          type: Number,
        },
        endRange: {
          type: Number,
        },
        icon: {
          type: String,
        },
      },
    ],
    logDescription: {
      type: String,
      default: '',
    },
    updatedFields: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('ChallengeLog', ChallengeLogSchema);
