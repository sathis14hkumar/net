const mongoose = require('mongoose');

const { Schema } = mongoose;

const leavePlannerSchema = new Schema(
  {
    buId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },

    opsGroup: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },

    ballotName: {
      type: String,
    },

    ballotAppOpeningDate: {
      type: Date,
    },

    ballotAppClosingDate: {
      type: Date,
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
    timeZone: {
      type: String,
    },
    ballotPeriodStartDate: {
      type: Date,
    },

    ballotPeriodEndDate: {
      type: Date,
    },

    ballotingLevel: {
      type: String,
    },

    PeriodSettings: {
      type: String,
    },

    segmentSettings: {
      type: String,
    },

    leaveType: {
      type: String,
    },

    resultReleaseDate: {
      type: Date,
    },

    selectWeekStartDay: {
      type: String,
    },

    selectWeek: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('leavePlanner', leavePlannerSchema);
