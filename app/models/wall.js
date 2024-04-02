const mongoose = require('mongoose');

const { Schema } = mongoose;

const WallSchema = new Schema(
  {
    wallName: {
      type: String,
      required: true,
    },
    displayType: {
      type: Number,
      default: 1, // 1.Consolidated 2.separated
    },
    postType: {
      type: Number,
      default: 1, // 1.LongWall 2.TallWall
    },
    isNomineeActive: {
      type: Boolean,
      default: false, // true.active false.inactive
    },
    isTaskActive: {
      type: Boolean,
      default: false, // true.active false.inactive
    },
    nominationOnlyByAdmin: {
      type: Boolean,
      default: false,
    },
    adminResponse: {
      type: Boolean,
      default: false,
    },
    postAnonymously: {
      type: Boolean,
      default: false, // true.active false.inactive
    },
    maxNomination: {
      enabled: {
        type: Boolean,
        default: false,
      },
      submissionLimit: {
        type: Number,
        default: 0,
      },
      submissionPeriod: {
        type: Number,
        default: 0, // 1.Monthly, 2.Quarterly, 3.Bi-annualy, 4.Yearly
      },
      createdAt: {
        type: Date,
      },
    },
    nominationPerUser: {
      enabled: {
        type: Boolean,
        default: false,
      },
      submissionLimit: {
        type: Number,
        default: 0,
      },
      submissionPeriod: {
        type: Number,
        default: 0, // 1.Monthly, 2.Quarterly, 3.Bi-annualy, 4.Yearly
      },
      createdAt: {
        type: Date,
      },
    },
    isEventWallRequired: {
      type: Boolean,
      default: false, // true.active false.inactive
    },
    quickNavEnabled: {
      type: Boolean,
      default: false,
    },
    bannerImage: {
      type: String,
      default: '',
    },
    eventWallStartDate: {
      type: Date,
      required: false,
    },
    eventWallEndDate: {
      type: Date,
      required: false,
    },
    category: [
      {
        type: Schema.Types.ObjectId,
        ref: 'WallCategory',
      },
    ],
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
          default: 1, // 1.allUser 2.includeUser 3.excludeUser
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
        allBuTokenStaffId: {
          type: String,
          default: '',
        },
        firstAdminAddedAsDefault: {
          type: Boolean,
          default: false,
        },
        customField: [],
      },
    ],
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    wallType: {
      type: Number, // 1- social wall, 2- event wall
      default: 1,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    status: {
      type: Number,
      default: 0, // 0 - draft, 1 - active, 2 - inactive , 3 -delete
    },
    assignedEmojis: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Emoji',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
WallSchema.index({ companyId: 1 });
WallSchema.index({ createdBy: 1 });
WallSchema.index({ status: 1 });
WallSchema.index({ wallName: 'text' });

module.exports = mongoose.model('Wall', WallSchema);
