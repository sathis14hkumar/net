const mongoose = require('mongoose');

const { Schema } = mongoose;

const SwapRequestSchema = new Schema(
  {
    // First with ballots slots and then with user holidays allocated.
    ballotId: {
      type: Schema.Types.ObjectId,
      ref: 'Ballot',
    },
    ballotIdTo: {
      type: Schema.Types.ObjectId,
      ref: 'Ballot',
    },
    userFrom: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    slotNumberFrom: Number,
    slotNumberTo: Number,
    opsGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },
    requestStatus: {
      type: Number, // 1-RequestSent 2-Approved 3-Rejected. 4-Cancelled by sender, 5-no action taken by receiver .
      default: 1,
    },
    // leaveFrom:{
    //     type: Schema.Types.ObjectId,
    //     ref: 'userHoliday'
    // },
    // leaveTo:{
    //     type: Schema.Types.ObjectId,
    //     ref: 'userHoliday'
    // }
    leaveFrom: {
      type: Schema.Types.ObjectId,
      ref: 'userleave',
    },
    leaveTo: {
      type: Schema.Types.ObjectId,
      ref: 'userleave',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('SwapRequest', SwapRequestSchema);
