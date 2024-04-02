const mongoose = require('mongoose');

const { Schema } = mongoose;

const resetPasswordSchema = new Schema(
  {
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resetDate: {
      type: Date,
    },
    resetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
resetPasswordSchema.index({ resetUserId: 1, updatedAt: -1 });

module.exports = mongoose.model('ResetPasswordLog', resetPasswordSchema);
