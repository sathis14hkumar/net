const mongoose = require('mongoose');

const { Schema } = mongoose;

const AppliedStaffSchema = new Schema(
  {
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: 'Shift',
    },
    shiftDetailsId: {
      type: Schema.Types.ObjectId,
      ref: 'ShiftDetails',
    },
    flexiStaff: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Number,
      default: 0,
    },
    isLimit: {
      type: Boolean,
      default: false,
    },
    limitMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
AppliedStaffSchema.index({ shiftDetailsId: 1, flexiStaff: 1 });

const AppliedStaff = mongoose.model('AppliedStaff', AppliedStaffSchema);

module.exports = AppliedStaff;
