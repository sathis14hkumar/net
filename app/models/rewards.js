const mongoose = require('mongoose');

const { Schema } = mongoose;

const rewardSchema = new Schema(
  {
    productCode: {
      type: String,
      default: '',
    },
    productName: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    orderNumber: {
      type: String,
      default: '',
    },
    view_code: {
      type: String,
      default: '',
    },
    voucher_name: {
      type: String,
      default: '',
    },
    voucher_ref: {
      type: String,
      default: '',
    },
    voucher_settlement_ref: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      default: '',
    },
    expiration_date: {
      type: String,
      default: '',
    },
    edenred_url: {
      type: String,
      default: '',
    },
    display_codes: {
      type: Array,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Rewards', rewardSchema);
