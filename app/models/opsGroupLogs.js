const mongoose = require('mongoose');

const { Schema } = mongoose;

const opsLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userName: {
      type: String,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    adminName: {
      type: String,
    },
    opsGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },
    opsGroupName: {
      type: String,
    },
    opsTeamId: {
      type: Schema.Types.ObjectId,
      ref: 'opsTeam',
    },
    opsTeamName: {
      type: String,
    },
    message: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);
const OpsLog = mongoose.model('opsGroupLog', opsLogSchema);

module.exports = OpsLog;
