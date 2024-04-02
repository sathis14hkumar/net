const mongoose = require('mongoose');

const { Schema } = mongoose;
// 28 field
const AssignShiftLogSchema = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    failedShift: {
      type: Object,
    },
    successShift: {
      type: Object,
    },
    description: {
      type: String,
    },
    weekRangeEndsAt: {
      type: Date,
    },
    weekRangeStartsAt: {
      type: Date,
    },
    weekNumber: {
      type: Number,
    },
    status: {
      type: Number, // 0 draft, 1 publish
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
AssignShiftLogSchema.index({ businessUnitId: 1 });
module.exports = mongoose.model('AssignShiftLog', AssignShiftLogSchema);
