const mongoose = require('mongoose');

const { Schema } = mongoose;

const SchemeSchema = new Schema(
  {
    companyID: {
      type: String,
      require: true,
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    isShiftInterval: {
      type: Boolean,
      default: false,
    },
    shiftIntervalHour: {
      type: Number,
      default: 0,
    },
    shiftIntervalMins: {
      type: Number,
      default: 0,
    },
    shiftIntervalTotal: {
      type: Number,
      default: 0,
    },
    shiftSchemeType: {
      type: Number,
      default: 1, // 1 felxi ,2 assign,3 flexi+Assign
    },
    schemeName: {
      type: String,
      require: true,
    },
    schemeDesc: {
      type: String,
      require: true,
    },
    schemeType: {
      type: Number,
      require: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    shiftSetup: {
      openShift: {
        type: Object,
        require: true,
      },
      assignShift: {
        type: Object,
        require: true,
      },
      limits: {
        normalHr: {
          type: Object,
          require: true,
        },
        otHr: {
          type: Object,
          require: true,
        },
        dayOverall: {
          type: Number,
          default: 0,
        },
        weekOverall: {
          type: Number,
          default: 0,
        },
        monthOverall: {
          type: Number,
          default: 0,
        },
      },
    },
    noOfWeek: {
      type: Number,
      default: 3,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
SchemeSchema.index({ businessUnitId: 1 });
SchemeSchema.index({ companyID: 1 });

module.exports = mongoose.model('Scheme', SchemeSchema);
