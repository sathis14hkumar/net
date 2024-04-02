const mongoose = require('mongoose');

const { Schema } = mongoose;

const userLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    oldSchemeId: {
      type: Schema.Types.ObjectId,
      ref: 'Scheme',
    },
    type: {
      type: String, // 1 scheme
    },
    newSchemeId: {
      type: Schema.Types.ObjectId,
      ref: 'Scheme',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
userLogSchema.index({ businessUnitId: 1 });

const UserLog = mongoose.model('UserLog', userLogSchema);

module.exports = UserLog;
