const mongoose = require('mongoose');

const { Schema } = mongoose;

const ReportCommentSchema = new Schema(
  {
    commentId: {
      type: Schema.Types.ObjectId,
      ref: 'PostComment',
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

// Indexes
ReportCommentSchema.index({ commentId: 1 });

module.exports = mongoose.model('ReportComment', ReportCommentSchema);
