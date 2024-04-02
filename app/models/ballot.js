const mongoosePaginate = require('mongoose-paginate');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const BallotSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'companies',
    },
    ballotName: {
      type: String,
    },
    applicationOpenDateTime: {
      type: Schema.Types.Date,
    },
    applicationCloseDateTime: {
      type: Schema.Types.Date,
    },
    openDate: {
      type: String,
    },
    openTime: {
      type: String,
    },
    closeDate: {
      type: String,
    },
    closeTime: {
      type: String,
    },
    resultReleaseDate: {
      type: String,
    },
    resultReleaseTime: {
      type: String,
    },
    leaveType: {
      type: Number,
      default: 0, // 0 not /1 Block /2 Casual
    },
    leaveConfiguration: {
      type: Number,
      default: 0, // 1 5+2 /2 6+1 /3 7+0
    },
    isAutoAssign: {
      type: Boolean,
      default: false,
    },
    weekStartDay: {
      type: String,
      default: 'Monday',
    },
    ballotStartDate: {
      type: Schema.Types.Date,
    },
    ballotEndDate: {
      type: Schema.Types.Date,
    },
    resultRelease: {
      type: Number,
      default: 0, // 0 / 1 Auto / 2 Manual
    },
    resultReleaseDateTime: {
      type: Schema.Types.Date,
    },
    userFrom: {
      type: Number,
      default: 0, // 0 / 1 OpsGroup/team / 2 BU
    },
    opsGroupId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'OpsGroup',
      },
    ],
    businessUnitId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSection',
      },
    ],
    slotCreation: [],
    weekRange: [],
    dayRange: [],
    isRestrict: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Number,
      default: 1,
    },
    maxSegment: [
      {
        segmentNo: {
          type: String,
        },
        startDate: {
          type: Date,
        },
        endDate: {
          type: Date,
        },
        maxBallot: {
          type: Number,
        },
      },
    ],
    maxConsecutiveBallot: {
      type: Number,
    },
    staffRestriction: [
      {
        weekNo: {
          type: Date,
        },
        startDate: {
          type: Date,
        },
        endDate: {
          type: Date,
        },
        slot: {
          type: String,
        },
        userList: [
          {
            id: {
              type: Schema.Types.ObjectId,
              ref: 'User',
            },
            label: {
              type: String,
            },
            parentBussinessUnitId: {
              type: Schema.Types.ObjectId,
            },
            opsTeamId: {
              type: Schema.Types.ObjectId,
            },
            opsGroupName: {
              type: String,
            },
            opsTeamName: {
              type: String,
            },
          },
        ],
      },
    ],
    isDraft: {
      type: Boolean,
      default: false,
    },
    isPublish: {
      type: Boolean,
      default: false,
    },
    isConduct: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isCanceled: {
      type: Boolean,
      default: false,
    },
    isNotified: {
      type: Number,
      default: 0, // 0 for 2 days // 1 for 1 day // 2 for same day//  3 for extended ballot //4 cancelled Ballot
    },
    appliedStaff: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        weekNo: {
          type: Number,
        },
        buId: {
          type: Schema.Types.ObjectId,
        },
        opsGroupId: {
          type: Schema.Types.ObjectId,
        },
        opsTeamId: {
          type: Schema.Types.ObjectId,
        },
      },
    ],
    cancelStaff: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        weekNo: {
          type: Number,
        },
      },
    ],
    wonStaff: [
      {
        opsGroupId: {
          type: Schema.Types.ObjectId,
        },
        opsTeamId: {
          type: Schema.Types.ObjectId,
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        weekNo: {
          type: Number,
        },
        buId: {
          type: Schema.Types.ObjectId,
        },
        isAutoAssign: {
          type: Boolean,
          default: false,
        },
        leaveTypeId: {
          type: Schema.Types.ObjectId,
          ref: 'LeaveType',
        },
        leaveGroupId: {
          type: Schema.Types.ObjectId,
          ref: 'LeaveGroup',
        },
      },
    ],
    deletedStaff: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        weekNo: {
          type: Number,
        },
      },
    ],
    parentBallot: {
      type: Schema.Types.ObjectId,
      ref: 'Ballot',
    },
    childBallots: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Ballot',
      },
    ],
    isResultRelease: {
      type: Boolean,
      default: false,
    },
    ballotRound: {
      type: Number,
      default: 0,
    },
    ballotExtendLogs: [
      {
        type: Schema.Types.Date,
      },
    ],
    adminId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    assignRatio: {
      type: Number,
      default: 0,
    },
    fixedBallotingLeaveType: {
      type: Boolean,
      default: false,
    },
    leaveTypeId: {
      type: String,
    },
    eligibleStaffsForAuto: [],
    staffLeave: [],
    totalQuota: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
BallotSchema.index({ businessUnitId: 1 });
BallotSchema.index({ createdBy: 1, adminId: 1 });
BallotSchema.index({ opsGroupId: 1 });

BallotSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Ballot', BallotSchema);
