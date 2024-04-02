const mongoose = require('mongoose');

const { Schema } = mongoose;

const WallCategorySchema = new Schema(
  {
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    categoryName: {
      type: String,
      default: '',
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
WallCategorySchema.index({ wallId: 1, status: 1 });

module.exports = mongoose.model('WallCategory', WallCategorySchema);
