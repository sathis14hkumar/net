const mongoose = require('mongoose');

const { Schema } = mongoose;

const FacialDataSchema = new Schema(
  {
    facialInfo: {
      type: String,
      default: '',
    },
    descriptor: {
      type: Object,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
FacialDataSchema.index({ userId: 1 });

const FacialData = mongoose.model('FacialData', FacialDataSchema);

module.exports = FacialData;
