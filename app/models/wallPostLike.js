const mongoose = require('mongoose');

const { Schema } = mongoose;

const PostLikeSchema = new Schema(
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
    isLiked: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Number,
      default: 0, // 1.active
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PostLikeSchema.index({ postId: 1, userId: 1 });

const PostLike = mongoose.model('PostLike', PostLikeSchema);

module.exports = PostLike;
