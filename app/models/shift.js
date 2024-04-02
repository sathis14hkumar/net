const mongoose = require('mongoose');

const { Schema } = mongoose;

const ShiftSchema = new Schema(
  {
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    isTemplate: {
      type: Number,
      default: 0,
    },
    isSplitShift: {
      type: Boolean,
      default: false,
    },
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'Template',
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
    plannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    skillSetTierType: {
      type: Number,
      default: 2,
    },
    shiftDetails: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ShiftDetails',
      },
    ],
    // Shift Created from Requested Change
    // isRequested: {
    //     type: Boolean,
    //     default: false
    // },
    // requestedShiftId: { // If it is created by request change
    //     type: Schema.Types.ObjectId,
    //     ref: 'Shift'
    // },
    status: {
      type: Number,
      default: 0, // 4 -> cancelled by planner
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ShiftSchema.index({
  businessUnitId: 1,
  weekRangeStartsAt: 1,
  weekRangeEndsAt: 1,
  weekNumber: 1,
});
ShiftSchema.index({ shiftDetails: 1 });

const Shift = mongoose.model('Shift', ShiftSchema);

module.exports = Shift;
