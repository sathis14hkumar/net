const mongoose = require('mongoose');

const { Schema } = mongoose;

const PrivilegeCategorySchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    privileges: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Privilege',
      },
    ],
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
PrivilegeCategorySchema.index({ name: 'text' });

const PrivilegeCategory = mongoose.model(
  'PrivilegeCategory',
  PrivilegeCategorySchema,
);

module.exports = PrivilegeCategory;
