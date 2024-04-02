const mongoose = require('mongoose');

const { Schema } = mongoose;

const QuestionSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
    },
    type: {
      type: Number, // 1-Free Text(Long), 2-multipleChoice( checkbox ), 3-trueFalse , 4-polling, 5 -radio button, 6.Signature, 7. Profile Fields, 8.Free Text(Short) , 9. Numeric, 10. Date & Time, 11. DropDown, 12. Attachement,13. Star Rating, 14.Conditional Questions
      default: 1,
    },
    options: [
      {
        value: {
          type: String,
        },
        correctAns: {
          type: Boolean,
        },
        imageSrc: {
          type: String,
        },
        coordinates: {
          x: {
            type: String,
          },
          y: {
            type: String,
          },
          radious: {
            type: String,
          },
          imgHeight: {
            type: String,
          },
          imgWidth: {
            type: String,
          },
        },
        pollingDescription: {
          type: String,
        },
        pollingDescriptionImageSrc: {
          type: String,
        },
        description: {
          type: String,
        },
      },
    ],
    optionsView: {
      type: Number,
      default: 1, // 0 : Vertical, 1 : Horizontal
    },
    value: {
      type: Schema.Types.Mixed,
    },
    assignUsers: [
      {
        businessUnits: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSection',
          },
        ],
        buFilterType: {
          type: Number,
          default: 1, // 1.alluser 2.includeUser 3.excludeUser
        },
        appointments: [
          {
            type: Schema.Types.ObjectId,
            ref: 'Appointment',
          },
        ],
        subSkillSets: [
          {
            type: Schema.Types.ObjectId,
            ref: 'SubSkillSet',
          },
        ],
        user: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        admin: [
          {
            type: Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
        allBuToken: {
          type: Boolean,
          default: false,
        },
        customField: [],
      },
    ],
    dateTime: [
      {
        type: Number, // 1. Date 2. Time
      },
      // date:{
      //     type:Date,
      //     default:Date.now
      // }
    ],
    maxlength: {
      type: Number,
      default: 0,
    },
    explanation: {
      type: String,
      default: '',
    },
    conditionalQuestions: [
      {
        questionId: {
          _id: {
            type: Schema.Types.ObjectId,
          },
          name: {
            type: String,
            required: true,
          },
        },
        optionId: {
          _id: {
            type: Schema.Types.ObjectId,
          },
          name: {
            type: String,
            required: true,
          },
        },
      },
    ],
    profile: [
      {
        questionName: {
          type: String,
        },
      },
    ],

    required: {
      type: Boolean,
      default: false,
    },
    chooseCount: {
      type: Number,
      default: 1,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'BuilderModule',
    },
    indexNum: {
      type: Number,
      default: 0,
    },
    status: {
      type: Number,
      default: 1, // 1-Active, 2-Inactive 3-deleted
    },
    imageSrc: {
      type: String,
      default: '',
    },
    ppimageuploadfrom: {
      type: Number,
      default: 0, // 0/1-Web, 2-Mobile // photopicker image upload from
    },
    extendedOption: {
      // for polling questionnaire
      type: Boolean,
      default: false,
    },
    pollingSelectionCount: {
      // how many maximun options can selected in polling question
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    autoIndex: true,
  },
);

// Indexes
QuestionSchema.index({ moduleId: 1 });
QuestionSchema.index({ moduleId: 1, status: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
