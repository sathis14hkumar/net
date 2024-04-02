const mongoose = require('mongoose');

const { Schema } = mongoose;

const UserFieldSchema = new Schema(
  {
    fieldName: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['text', 'date', 'dropdown'],
      default: 'text',
    },
    // In Case Dropdown - Number (or) String
    options: [],
    required: {
      type: Boolean,
      default: false,
    },
    editable: {
      type: Boolean,
      default: false,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    indexNum: {
      type: Number,
      default: 0,
    },
    status: {
      type: Number,
      default: 1, // 1-Active, 2-Inactive
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
UserFieldSchema.index({ companyId: 1, fieldName: 1 });

module.exports = mongoose.model('UserField', UserFieldSchema);
