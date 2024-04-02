const mongoose = require('mongoose');

const { Schema } = mongoose;

const leaveApplicationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    ballotId: {
      type: Schema.Types.ObjectId,
      ref: 'Ballot',
    },
    slotNo: Number,
    fromdate: String,
    todate: String,
    noOfdays: Number,
    leaveId: {
      type: Schema.Types.ObjectId,
      ref: 'userHoliday',
    },
    isSpecialLeave: {
      type: Boolean,
      default: false,
    },
    applicationStatus: {
      type: Number,
      default: 1, // 1 - pending ,2 - accepted, 3-Rejected
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('leaveApplication', leaveApplicationSchema);
