const mongoose = require('mongoose');

const { Schema } = mongoose;

const RewardImportLogSchema = new Schema(
  {
    challengeId: {
      type: String,
      default: '',
    },
    success: {
      type: Number,
      default: 0,
    },
    fail: {
      type: Number,
      default: 0,
    },
    failDetails: {
      type: String,
    },
    createdBy: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('rewardImportLog', RewardImportLogSchema);
