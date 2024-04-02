const mongoose = require('mongoose');

const { Schema } = mongoose;

const PostCategorySchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    channelId: {
      type: String,
      ref: 'Channel',
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
PostCategorySchema.index({ channelId: 1 });
module.exports = mongoose.model('PostCategory', PostCategorySchema);
