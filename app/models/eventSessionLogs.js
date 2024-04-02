const mongoose = require('mongoose');

const { Schema } = mongoose;

const eventSessionLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    session: {},

    description: {
      type: String,
      default: '',
    },
    status: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);
const ShiftLog = mongoose.model('eventSessionLog', eventSessionLogSchema);

module.exports = ShiftLog;
