const mongoose = require('mongoose');

const { Schema } = mongoose;

const StaffLimitSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
    },
    shiftDetailId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    childShiftId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    date: {
      type: Date,
    },
    assignShiftId: {
      type: Schema.Types.ObjectId,
      ref: 'AssignShift',
    },
    isAssignShift: {
      type: Boolean,
      default: false,
    },
    normalDuration: {
      type: Number,
      default: 0,
    },
    otDuration: {
      type: Number,
      default: 0,
    },
    weekNumber: {
      type: Number,
    },
    totalBreakDuration: {
      type: Number,
      default: 0,
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    splitStartTime: {
      type: Date,
      default: null,
    },
    splitEndTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
StaffLimitSchema.index({ userId: 1, date: 1, shiftDetailId: 1 });

const StaffLimit = mongoose.model('StaffLimit', StaffLimitSchema);

module.exports = StaffLimit;
