const mongoose = require('mongoose');

const { Schema } = mongoose;

const EmojiSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    emoji: {
      type: String,
      default: '',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    status: {
      type: Number,
      default: 0,
    },
    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Wall',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
EmojiSchema.index({ companyId: 1 });

module.exports = mongoose.model('Emoji', EmojiSchema);
