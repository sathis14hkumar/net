const mongoose = require('mongoose');

const { Schema } = mongoose;

const AuthenticatedSchema = new Schema(
  {
    tokenId: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

AuthenticatedSchema.index({ tokenId: 1 });
const Authenticated = mongoose.model('authenticate', AuthenticatedSchema);

module.exports = Authenticated;
