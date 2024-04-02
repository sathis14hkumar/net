const mongoose = require('mongoose');

const { Schema } = mongoose;

const SubSkillSetSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    skillSetId: {
      type: Schema.Types.ObjectId,
      ref: 'SkillSet',
    },
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
SubSkillSetSchema.index({ skillSetId: 1 });

module.exports = mongoose.model('SubSkillSet', SubSkillSetSchema);
