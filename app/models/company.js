const mongoose = require('mongoose');

const { Schema } = mongoose;

const CompanySchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      default: '',
    },
    integration: {
      type: Boolean,
      default: false,
    },
    pathName: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    departments: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    status: {
      type: Number,
      default: 0,
    },
    ceraToken: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Company', CompanySchema);
