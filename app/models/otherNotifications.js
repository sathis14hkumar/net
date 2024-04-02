const mongoose = require('mongoose');

const { Schema } = mongoose;

const OtherNotificationSchema = new Schema(
  {
    title: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    fromUser: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    type: Number,
  },
  {
    timestamps: true,
  },
);

// Indexes
OtherNotificationSchema.index({ user: 1 });

module.exports = mongoose.model('OtherNotification', OtherNotificationSchema);
