const mongoose = require('mongoose');

const { Schema } = mongoose;

const WallPostSchema = new Schema(
  {
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    category: [
      {
        type: Schema.Types.ObjectId,
        ref: 'WallCategory',
      },
    ],
    title: {
      type: String,
      default: '',
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    assignedEmojis: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Emoji',
      },
    ],
    attachments: {
      type: Array,
      default: [],
    },
    likedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    priorityDate: {
      type: Date,
    },
    isLiked: {
      type: Boolean,
      default: false,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    sharedCount: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    sharedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    taskList: [
      {
        name: {
          type: String,
          default: '',
        },
        status: {
          type: Number,
          default: 0,
        },
        createdBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        createdAt: {
          type: Date,
        },
        completedBy: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        completedAt: {
          type: Date,
        },
      },
    ],
    assignedToList: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    nomineeUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    taskDueDate: {
      type: Date,
    },
    isTaskNotified: {
      type: Boolean,
      default: false,
    },
    anonymousPost: {
      type: Boolean,
      default: false,
    },

    isTaskCompleted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: Number,
      default: 0, // draft, active , inactive, delete
    },
    postReport: {
      type: Schema.Types.ObjectId,
      ref: 'ReportPost',
    },
    // Module
    moduleIncluded: {
      type: Boolean,
      default: false,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'BuilderModule',
    },
    isShared: {
      type: Number,
      default: 0,
    },
    sharedType: {
      type: Number, // 1 -wall , 2 - channel
    },
    // shared from wall posts
    fromWall: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    fromWallPost: {
      type: Schema.Types.ObjectId,
      ref: 'WallPost',
    },
    // Shared from news & events
    fromChannel: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    fromPost: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
WallPostSchema.index({ category: 1, status: 1 });
WallPostSchema.index({ wallId: 1, status: 1, lastUpdated: -1 });

module.exports = mongoose.model('WallPost', WallPostSchema);
