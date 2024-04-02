const mongoose = require('mongoose');

const { Schema } = mongoose;

const ChallengeStatusNonRewardSchema = new Schema(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Boolean,
      default: true,
    },
    totalRewardPoints: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model(
  'ChallengeStatusNonReward',
  ChallengeStatusNonRewardSchema,
);
