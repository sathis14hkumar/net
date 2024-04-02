const mongoose = require('mongoose');

const { Schema } = mongoose;

const WallPostAdminResponseSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'WallPost',
    },
    wallId: {
      type: Schema.Types.ObjectId,
      ref: 'Wall',
    },
    adminResponse: {
      type: String,
      default: '',
    },
    privateResponse: {
      type: Boolean,
      default: false,
    },
    attachment: {
      type: Object,
      default: {},
    },
    status: {
      type: Number,
      default: 1, // 1.active 2.deleted
    },
  },
  {
    timestamps: true,
  },
);

const AdminResponse = mongoose.model(
  'WallPostAdminResponse',
  WallPostAdminResponseSchema,
);

module.exports = AdminResponse;
