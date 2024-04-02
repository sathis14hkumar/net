const mongoose = require('mongoose');

const { Schema } = mongoose;

const PostLogSchema = new Schema(
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
    },
    publishing: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
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
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    logstatus: {
      type: Number,
      default: 0, // 1.create 2.update 3. delete
    },
    logDescription: {
      type: String,
      default: '',
    },
    id: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
PostLogSchema.index({ wallName: 'text' });

module.exports = mongoose.model('PostLog', PostLogSchema);
