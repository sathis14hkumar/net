const mongoose = require('mongoose');

const { Schema } = mongoose;

const ReportChannelPostSchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ReportChannelPostSchema.index({ userId: 1 });

module.exports = mongoose.model('ReportChannelPost', ReportChannelPostSchema);
