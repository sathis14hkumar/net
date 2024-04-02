const mongoose = require('mongoose');

const { Schema } = mongoose;

const redeemedSettingSchema = new Schema(
  {
    name: {
      type: String,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
    },
    landingPage: {
      redeemablePoints: {
        type: Boolean,
      },
      pointsOngoing: {
        type: Boolean,
      },
      name: {
        type: Boolean,
      },
      appointment: {
        type: Boolean,
      },
      newItem: {
        items: {
          type: Boolean,
        },
        numberOfItems: {
          type: Number,
        },
        numberOfDays: {
          type: Number,
        },
      },
      popularItem: {
        items: {
          type: Boolean,
        },
        numberOfItems: {
          type: Number,
        },
      },
    },
    categoryPage: {
      selectCategory: {
        type: Boolean,
        default: true,
      },
      sortCategory: {
        type: Boolean,
        default: true,
      },
      displayCategory: {
        type: Boolean,
        default: true,
      },
    },
    assignCategory: {
      type: String,
    },
    targetAudience: {
      type: String,
    },
    points: {
      type: Number,
    },
    redemptionPoints: {
      type: Number,
      default: 0,
    },
    status: {
      /*  0 - pending , 1- active, 2- ceased */
      type: Number,
      default: 0,
    },
    itemName: {
      type: String,
    },
    brandName: {
      type: String,
    },
    itemDescription: {
      type: String,
    },
    termsAndConditions: {
      type: String,
    },
    outletsInformation: {
      type: String,
    },
    brandImage: {
      type: String,
    },
    itemImage1: {
      type: String,
    },
    itemImage2: {
      type: String,
    },
    itemImage3: {
      type: String,
    },
    itemImage4: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('RedeemedSettings', redeemedSettingSchema);
