const mongoose = require('mongoose');

const { Schema } = mongoose;

const StaffSapData = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    staff_Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userId: {
      type: String,
    },
    username: {
      type: String,
    },
    ParentBU: {
      type: String,
    },
    leavesEntitled: {
      type: Number,
      default: 0,
    },

    leavesAvailed: {
      type: Number,
      default: 0,
    },
    leavesBalanced: {
      type: Number,
      default: 0,
    },
    ballotLeaveBalanced: {
      type: Number,
      default: 0,
    },
    daysBallotApplied: {
      type: Number,
      default: 0,
    },
    postBallotBalance: {
      type: Number,
      default: 0,
    },
    staffRoleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
    },
    staffAppointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    subSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSkillSet',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
StaffSapData.index({ staff_Id: 1 });

module.exports = mongoose.model('StaffSapData', StaffSapData);
