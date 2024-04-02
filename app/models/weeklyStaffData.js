const mongoose = require('mongoose');

const { Schema } = mongoose;

const WeeklyStaffDataSchema = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
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
    flexiStaffData: {
      type: Object,
    },
    staffData: {
      type: Object,
    },
    status: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
WeeklyStaffDataSchema.index({ businessUnitId: 1, weekNumber: 1 });

const WeeklyStaffData = mongoose.model(
  'WeeklyStaffData',
  WeeklyStaffDataSchema,
);

module.exports = WeeklyStaffData;
