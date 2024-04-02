const mongoose = require('mongoose');
const { buFilterType } = require('./enums');

const { Schema } = mongoose;

const ChallengeTeamSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    name: { type: String },
    logo: { type: String },
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
          enum: [
            buFilterType.allUser,
            buFilterType.includeUser,
            buFilterType.excludeUser,
          ],
          default: buFilterType.allUser,
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
        customField: [],
      },
    ],
    status: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('ChallengeTeam', ChallengeTeamSchema);
