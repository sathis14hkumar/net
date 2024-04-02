const mongoose = require('mongoose');

const { Schema } = mongoose;

const EventSessionSchema = new Schema(
  {
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    startTime: {
      type: String,
    },
    endTime: {
      type: String,
    },
    totalParticipantPerSession: {
      type: Number,
      default: 0,
    },
    location: {
      type: String,
    },
    attendaceRequiredCount: {
      type: Number,
      default: 0,
    },
    adminIds: [
      {
        type: String,
        ref: 'User',
      },
    ],
    assignAdmin: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AdminUser',
      },
    ],
    createdOn: {
      type: Date,
    },
    updatedOn: {
      type: Date,
    },
    status: {
      type: Number,
      default: 0,
    },
    checked: Boolean,
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
EventSessionSchema.index({ post: 1 });

const EventSession = mongoose.model('eventsession', EventSessionSchema);

module.exports = EventSession;
