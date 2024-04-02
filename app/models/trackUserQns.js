const mongoose = require('mongoose');

const { Schema } = mongoose;

const trackUserQnsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'BuilderModule',
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Notification',
    },
    wallPostId: {
      type: Schema.Types.ObjectId,
      ref: 'WallPost',
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    status: {
      type: Number,
      default: 1,
    },
    questionAnswered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    autoIndex: true,
  },
);

// Indexes
trackUserQnsSchema.index({ notificationId: 1, userId: 1 });

module.exports = mongoose.model('trackUserQns', trackUserQnsSchema);
