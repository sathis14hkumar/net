const mongoose = require('mongoose');

const { Schema } = mongoose;

const ChallengeStatusSchema = new Schema(
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
    teamId: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ChallengeStatusSchema.index({ challengeId: 1, userId: 1 });
ChallengeStatusSchema.index({ userId: 1 });
module.exports = mongoose.model('ChallengeStatus', ChallengeStatusSchema);
