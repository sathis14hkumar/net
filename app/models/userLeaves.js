const mongoose = require('mongoose');

const { Schema } = mongoose;

const leavesSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    ballotId: {
      type: Schema.Types.ObjectId,
      ref: 'Ballot',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    slotNo: Number,
    ballotRound: Number,
    fromdate: String,
    todate: String,
    type: Number, // 1-Balloted-Block, 2-casual, 3-block , 4-special
    status: String, // Allocated, Balloted,Cancelled
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

// Indexes
leavesSchema.index({ fromdate: 1, todate: 1 });
leavesSchema.index({ userId: 1 });

module.exports = mongoose.model('userleave', leavesSchema);
