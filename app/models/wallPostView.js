const mongoose = require('mongoose');

const { Schema } = mongoose;

const PostViewSchema = new Schema(
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
    wallPostId: {
      type: Schema.Types.ObjectId,
      ref: 'WallPost',
    },
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    viewHistory: [
      {
        type: Date,
      },
    ],
    postType: {
      type: String,
      enum: ['wall', 'channel'],
    },
    status: {
      type: Number,
      default: 1, // 1.active
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PostViewSchema.index({ postId: 1 });

const PostView = mongoose.model('PostView', PostViewSchema);

module.exports = PostView;
