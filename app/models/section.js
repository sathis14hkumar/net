const mongoose = require('mongoose');

const { Schema } = mongoose;

const SectionSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
    },
    subSections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSection',
      },
    ],
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
SectionSchema.index({ departmentId: 1 });

module.exports = mongoose.model('Section', SectionSchema);
