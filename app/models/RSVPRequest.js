const mongoose = require('mongoose');

const { Schema } = mongoose;

const RSVPRequestSchema = new Schema(
  {
    staff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'eventsession',
    },
    isRSVPRequested: {
      type: Boolean,
    },
    isRSVPCancelled: {
      type: Boolean,
    },
    isRSVPRequestAccepted: {
      type: Boolean,
      default: true,
    },
    isRSVPRequestDeclined: {
      type: Boolean,
    },
    isDeleted: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
    usePushEach: true,
  },
);

// Indexes
RSVPRequestSchema.index({ event: 1 });
RSVPRequestSchema.index({ session: 1, event: 1, staff: 1 });
RSVPRequestSchema.index({ staff: 1 });

const RSVPRequestModel = mongoose.model('RSVPRequest', RSVPRequestSchema);

module.exports = RSVPRequestModel;
