const mongoose = require('mongoose');

const { Schema } = mongoose;

const ChallengeCriteriaSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    wallPost: {
      type: Schema.Types.ObjectId,
      ref: 'WallPost',
    },
    channelPost: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    manageForm: {
      type: Schema.Types.ObjectId,
      ref: 'ManageForm',
    },
    criteriaSourceType: {
      type: Number,
      /** 1: Reading Articles 2: Quessionalries, 3: Event attendence 4: Post Done 5: First Login */
      enum: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      default: 1,
    },
    directReward: {
      rewardedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      rewardDate: {
        type: Date,
      },
      comment: {
        type: String,
      },
    },
    rewardPoints: {
      type: Number,
      default: 0,
    },
    criteriaCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: Boolean,
      default: false,
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
ChallengeCriteriaSchema.index({ userId: 1, criteriaSourceType: 1 });
ChallengeCriteriaSchema.index({
  challengeId: 1,
  rewardPoints: 1,
  createdAt: 1,
});
module.exports = mongoose.model('ChallengeCriteria', ChallengeCriteriaSchema);
