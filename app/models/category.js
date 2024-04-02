const mongoose = require('mongoose');

const { Schema } = mongoose;

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    subCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
    ],
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
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
CategorySchema.index({ companyId: 1 });
module.exports = mongoose.model('Category', CategorySchema);
