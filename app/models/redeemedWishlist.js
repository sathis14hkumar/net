const mongoose = require('mongoose');

const { Schema } = mongoose;

const redeemedWishlist = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      default: 0,
    },
    points: {
      type: Number,
      default: 0,
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

module.exports = mongoose.model('RedeemedWishlist', redeemedWishlist);
