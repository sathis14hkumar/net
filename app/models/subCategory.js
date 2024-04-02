const mongoose = require('mongoose');

const { Schema } = mongoose;

const SubCategorySchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
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
SubCategorySchema.index({ categoryId: 1 });

module.exports = mongoose.model('SubCategory', SubCategorySchema);
