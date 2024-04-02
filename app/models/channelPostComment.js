const mongoose = require('mongoose');

const { Schema } = mongoose;

const PostCommentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    comment: {
      type: String,
      default: '',
    },
    attachment: {
      type: Object,
      default: {},
    },
    status: {
      type: Number,
      default: 0, // 1.active 2.inActive
    },
    reportList: [
      {
        reportedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
PostCommentSchema.index({ postId: 1 });

const PostComment = mongoose.model('ChannelPostComment', PostCommentSchema);

module.exports = PostComment;
