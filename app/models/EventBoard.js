const mongoose = require('mongoose');

const { Schema } = mongoose;

const EventBoardSchema = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },
    isEventBoardRequired: {
      type: Boolean,
      default: false, // true.EventBoardRequired false.noEventBoardRequired
    },
    eventBoardTitle: {
      type: String,
      default: false, // true.AttendanceRequired false.not AttendanceRequired
    },
    eventIcon: {
      type: String,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
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
  },
  {
    timestamps: true,
  },
);

const Board = mongoose.model('EventBoard', EventBoardSchema);

module.exports = Board;
