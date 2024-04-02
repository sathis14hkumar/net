const mongoose = require('mongoose');

const { Schema } = mongoose;

const DepartmentSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    sections: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Section',
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
DepartmentSchema.index({ companyId: 1, name: 1 });
module.exports = mongoose.model('Department', DepartmentSchema);
