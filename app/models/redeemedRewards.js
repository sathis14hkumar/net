const mongoose = require('mongoose');

const { Schema } = mongoose;

const redeemedRewardSchema = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    description: {
      type: String,
      default: '',
    },
    points: {
      type: Number,
      default: 0,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    code: {
      type: String,
      default: '',
    },
    barcode: {
      type: String,
      default: '',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    userBusinessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'SubSection',
    },
    rewardId: {
      type: String,
      default: '',
    },
    terms_and_conditions: {
      type: String,
    },
    thumbnail_img_url: {
      type: String,
    },
    display_img_url: {
      type: String,
    },
    type: {
      type: String,
      enum: ['spending', 'earning'],
      default: 'spending',
    },
    merchant: {
      name: {
        type: String,
      },
      description: {
        type: String,
      },
      website: {
        type: String,
      },
    },
    redeemable: {
      type: Boolean,
    },
    totalRewardPoints: {
      type: Number,
      default: 0,
    },
    productCode: {
      type: String,
      default: '',
    },
    productName: {
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
    qrCode: {
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
    category: {
      type: String,
      default: '',
    },
    category_id: {
      type: Number,
    },
    uUid: {
      type: String,
    },
    isSuccess: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
redeemedRewardSchema.index({ userId: 1 });
redeemedRewardSchema.index({ userBusinessUnitId: 1, createdAt: -1 });
module.exports = mongoose.model('RedeemedRewards', redeemedRewardSchema);
