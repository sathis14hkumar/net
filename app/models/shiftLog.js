const mongoose = require('mongoose');

const { Schema } = mongoose;

const shiftLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    newTiming: {
      type: Object,
    },
    shiftId: {
      type: String,
      default: '',
    },
    requestedShift: {
      type: String,
      default: '',
    },
    adjustedShift: {
      type: String,
      default: '',
    },
    pendingShift: {
      type: String,
      default: '',
    },
    acceptedShift: {
      type: String,
      default: '',
    },
    rejectedShift: {
      type: String,
      default: '',
    },
    existingShift: {
      type: String,
      default: '',
    },
    weekNumber: {
      type: Number,
      default: 1,
    },
    weekRangeStartsAt: {
      type: Date,
    },
    weekRangeEndsAt: {
      type: Date,
    },
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

// Indexes
shiftLogSchema.index({ businessUnitId: 1, weekNumber: 1 });

const ShiftLog = mongoose.model('ShiftLog', shiftLogSchema);

module.exports = ShiftLog;
