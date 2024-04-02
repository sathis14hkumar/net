const mongoose = require('mongoose');

const { Schema } = mongoose;

const opsLeaveSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    opsGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
      unique: true,
    },
    name: String,
    opsTeamId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'opsTeam',
      },
    ],
    users: [
      {
        staffId: String,
        name: String,
        id: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        teamId: {
          type: Schema.Types.ObjectId,
          ref: 'opsTeam',
        },
        teamName: String,
        leaveStatus: {
          type: String,
          enum: ['No Application', 'Balloted', 'Approved', 'Pending Approval'],
          default: 'No Application',
        },
      },
    ],
    perDayQuota: {}, // This will have list of objects whose properties are date and quota
    // structure for per day quota needs to be as bellow
    /*
    perdayQuota: {id:32, name:name, quota:[{date:12/3/2001, value:2}],
            opsTeam:[{id:1,name:name,quota:[{data:11/2/2003,value:1}]},
                {id:2,name:nameofteam,quota:[{date:11/2/2003,value:2}]}]
        }

    */
    adminId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'companies',
    },
    ballots: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Ballot',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
opsLeaveSchema.index({ ballots: 1 });
opsLeaveSchema.index({ opsGroupId: 1 });

module.exports = mongoose.model('opsLeaveManage', opsLeaveSchema);
