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
      ref: 'WallPost',
    },
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
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
    reportCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PostCommentSchema.index({ postId: 1 });

const PostComment = mongoose.model('PostComment', PostCommentSchema);

module.exports = PostComment;
