const mongoose = require('mongoose');

const { Schema } = mongoose;

const postSchema = new Schema(
  {
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    wallName: {
      type: String,
      default: '',
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'PostCategory',
    },
    teaser: {
      title: {
        type: String,
        default: '',
      },
      image: {
        type: String,
        default: '',
      },
      listingType: {
        type: Number,
        default: 1, // 1 - no image , 2 - small image  , 3 - large image
      },
    },
    sessions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'eventsession',
      },
    ],
    content: {
      title: {
        type: String,
        default: '',
      },
      image: {
        type: String,
        default: '',
      },
      isTeaserImage: {
        type: Boolean,
        default: false,
      },
      content: {
        type: String,
        default: '',
      },
    },
    eventDetails: {
      organizerName: {
        type: String,
        default: '',
      },
      address: {
        type: String,
        default: '',
      },
      eventType: {
        type: String,
        enum: ['single', 'multi'],
      },
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      isRSVPRequired: {
        type: Boolean,
        default: true, // true.required false.notRequired
      },
      isLimitRSVP: {
        type: Boolean,
        default: false,
      },
      maxNoRSVP: {
        type: Number,
        default: 0,
      },
      isLimitRequired: {
        type: Boolean,
        default: false, // true.limitRequired false.noLimitRequired
      },
      isAttendanceRequired: {
        type: Boolean,
        default: true, // true.AttendanceRequired false.not AttendanceRequired
      },
      totalAttendanceTaking: {
        type: Number,
        default: 0,
      },
      isEventWallRequired: {
        type: Boolean,
        default: false,
      },
    },
    publishing: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
      isSession: Boolean,
      NumberOfSessions: Number,
    },
    userOptions: {
      like: {
        type: Boolean,
        default: false,
      },
      comment: {
        type: Boolean,
        default: false,
      },
      share: {
        type: Boolean,
        default: false,
      },
      registration: {
        type: Boolean,
        default: false,
      },
      attendance: {
        type: Boolean,
        default: false,
      },
      socialWall: {
        type: Boolean,
        default: false,
      },
    },
    postType: {
      type: String,
      enum: ['news', 'event'],
      default: 'news',
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
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    notifiedSent: {
      // push notification on publishing time
      type: Boolean,
      default: false,
    },
    status: {
      type: Number,
      default: 0,
    },
    eventLog: [
      {
        type: Schema.Types.ObjectId,
        ref: 'eventSessionLog',
      },
    ],
    updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    usePushEach: true,
  },
);

// Indexes
postSchema.index({ categoryId: 1 });
postSchema.index({ channelId: 1 });
postSchema.index({ 'publishing.startDate': 1, 'publishing.endDate': 1 });

module.exports = mongoose.model('Post', postSchema);
