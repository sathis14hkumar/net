const mongoose = require('mongoose');

const { Schema } = mongoose;

const DisqualifyUserSchema = new Schema(
  {
    challengeId: {
      type: Schema.Types.ObjectId,
      ref: 'Challenge',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    fromDate: {
      type: Date,
      default: '',
    },
    toDate: {
      type: Date,
      default: '',
    },
    status: {
      type: Number,
      default: 0, // 0.inactive, 1.active, 2.deleted
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('DisqualifyUser', DisqualifyUserSchema);
