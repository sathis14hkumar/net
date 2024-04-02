const mongoose = require('mongoose');

const { Schema } = mongoose;

const RewardsVoucherSchema = new Schema(
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
    redeemPoints: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      default: '',
    },
    category_id: {
      type: Number,
    },
    display_img_url: {
      type: String,
      default: '',
    },
    thumbnail_img_url: {
      type: String,
      default: '',
    },
    code: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      default: '',
    },
    qrCode: {
      type: String,
      default: '',
    },
    companyId: {
      type: String,
      default: '',
    },
    companyName: {
      type: String,
      default: '',
    },
    redemption_type: {
      type: String,
      default: 'e_voucher',
    },
    status: {
      type: String,
      default: 'Active',
    },
    expiration_date: {
      type: String,
    },
    voucherCodes: {
      type: Array,
      default: [],
    },
    voucherCodesBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('RewardsVouchersList', RewardsVoucherSchema);
