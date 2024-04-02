const mongoose = require('mongoose');

const { Schema } = mongoose;

const SkillSetSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    subSkillSets: [
      {
        type: Schema.Types.ObjectId,
        ref: 'SubSkillSet',
      },
    ],
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
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
SkillSetSchema.index({ companyId: 1 });

module.exports = mongoose.model('SkillSet', SkillSetSchema);
