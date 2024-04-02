const mongoose = require('mongoose');

const { Schema } = mongoose;

const holidaySchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    opsGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },
    opsTeamId: {
      type: Schema.Types.ObjectId,
      ref: 'opsTeam',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    username: String,
    fromdate: String,
    todate: String,
    type: Number, // 3-block 2-casual, 4-special
    status: String,
    reason: String,
    approveStatus: {
      type: Boolean,
      default: false,
    },
    isSwapable: {
      type: Boolean,
      default: false,
    },
    attachment: {
      type: String,
      default: '',
    },
    fileName: String,
    logs: [
      {
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        updatedBy: String,
        message: Number, // 1-Allocation 2- Change date 3-cancellation,4-applied
        fromdate: String,
        todate: String,
        fromCurrentdate: String,
        toCurrentdate: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('userHoliday', holidaySchema);
