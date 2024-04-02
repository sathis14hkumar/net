const mongoose = require('mongoose');

const { Schema } = mongoose;

const opsTeamSchema = new Schema(
  {
    userId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    adminId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    buId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'OpsGroup',
      },
    ],
    updatedBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        dateTime: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    opsGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'OpsGroup',
    },
    name: {
      type: String,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
opsTeamSchema.index({ name: 'text' });
opsTeamSchema.index({ userId: 1, opsGroupId: 1 });

module.exports = mongoose.model('opsTeam', opsTeamSchema);
