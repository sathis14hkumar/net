const mongoose = require('mongoose');

const { Schema } = mongoose;

const OpsGroupSchema = new Schema(
  {
    opsGroupName: {
      type: String,
      unique: true,
      required: true,
    },
    userId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    buId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSection',
      },
    ],
    opsTeamId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'opsTeam',
      },
    ],
    removeOpsTeamId: [
      {
        teamId: {
          type: Schema.Types.ObjectId,
          ref: 'opsTeam',
        },
        deletedDateTime: {
          type: Date,
          value: Date.now(),
        },
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    companyId: {
      type: Schema.Types.ObjectId,
    },
    updatedBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        dateTime: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    noOfTeam: {
      type: Number,
      default: 0,
    },
    swopSetup: {
      type: String,
      default: 0, // 0 no swop // 1 swop at group level // 2 at team level;
    },
    adminId: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDelete: {
      type: Boolean,
      default: false,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
OpsGroupSchema.index({ adminId: 1 });
OpsGroupSchema.index({ buId: 1 });
OpsGroupSchema.index({ companyId: 1 });
OpsGroupSchema.index({ createdBy: 1 });
OpsGroupSchema.index({ opsGroupName: 1 });
OpsGroupSchema.index({ opsGroupName: 'text' });
OpsGroupSchema.index({ opsTeamId: 1 });
OpsGroupSchema.index({ userId: 1 });

module.exports = mongoose.model('OpsGroup', OpsGroupSchema);
