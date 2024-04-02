const mongoose = require('mongoose');

const { Schema } = mongoose;

const EventSchema = new Schema(
  {
    listingType: {
      type: String,
    },
    teaserTitle: {
      type: String,
    },
    teaserImage: {
      type: String,
    },
    contentTitle: {
      type: String,
    },
    isTeaserImgSame: {
      type: Boolean,
    },
    contentImage: {
      type: String,
    },
    eventContent: {
      type: String,
    },
    organizerName: {
      type: String,
    },
    address: {
      type: String,
    },
    eventType: {
      type: String,
    },
    eventDate: {
      type: Date,
    },
    isDraft: {
      type: String,
    },
    sessionTotal: {
      type: Number,
    },
    isRSVP: {
      type: Boolean,
    },
    isLimit: {
      type: Boolean,
    },
    isAttendaceRequired: {
      type: Boolean,
    },
    sessionsList: [
      {
        type: Schema.Types.ObjectId,
        ref: 'eventsession',
      },
    ],
    isDeleted: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
    usePushEach: true,
  },
);

const EventModel = mongoose.model('event', EventSchema);

module.exports = EventModel;
