const mongoose = require('mongoose');

const { Schema } = mongoose;

const notificationCronSchema = new Schema(
  {
    data: {
      _id: {
        type: String,
      },
      moduleType: {
        // pushNotification
        type: String,
      },
      title: {
        type: String,
        default: '',
      },
      description: {
        type: String,
        default: '',
      },
      effectiveFrom: {
        type: Date,
        default: '',
      },
      effectiveTo: {
        type: Date,
        default: '',
      },
      activeFrom: {
        type: Date,
      },
      activeTo: {
        type: Date,
      },
      businessUnitId: {
        type: String,
      },
      notifyAcknowledgedUsers: [
        {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      status: {
        type: Number,
        default: 0,
      },
      notificationType: {
        type: Number,
        default: 0, // 1 adhoc 2 schedule
      },
      timeZone: {
        type: String,
      },
      isPublish: {
        type: Boolean,
        default: false, // false means draft true means is publish
      },
      notificationStatus: {
        type: Number,
        default: 0, // 0 draft 1 pending(publish) 2 complete 3 cancelled
      },
      day: {
        type: Number,
      },
    },
    totalSent: {
      type: Number,
    },
    name: {
      type: String,
    },
    priority: {
      type: Number,
    },
    type: {
      type: String,
    },
    nextRunAt: {
      type: Date,
    },
    lockedAt: {
      type: Date,
    },
    lastModifiedBy: {
      type: Date,
    },
    lastFinishedAt: {
      type: Date,
    },
    lastRunAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    autoIndex: true,
  },
);

notificationCronSchema.index({
  'data.businessUnitId': 1,
  'data.notificationType': 1,
  lastFinishedAt: 1,
});
notificationCronSchema.index({ nextRunAt: 1 });
module.exports = mongoose.model('notificationCron', notificationCronSchema);
