const mongoose = require('mongoose');

const { Schema } = mongoose;

const CustomFormSchema = new Schema(
  {
    title: {
      type: String,
      default: '',
    },
    formName: {
      type: String,
      default: '',
    },
    isDeployed: {
      // 1. Web and Mobile(Internal), 2. Internet(External)
      type: Number,
      default: 0,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
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
        allBuTokenStaffId: {
          type: String,
          default: '',
        },
        customField: [],
      },
    ],

    formLogo: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    viewOnly: {
      type: Boolean,
      default: false,
    },
    formUrl: {
      type: String,
      default: '',
    },
    // user
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    userStatusVisibility: {
      type: Boolean,
      default: false,
    },

    quickNavEnabled: {
      type: Boolean,
      default: false,
    },
    // Module
    moduleIncluded: {
      type: Boolean,
      default: false,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'BuilderModule',
    },
    additionalModuleId: {
      type: Schema.Types.ObjectId,
      ref: 'BuilderModule',
    },
    statusFormType: {
      type: Number, // 0-draft,1-published,
      default: 0,
    },
    status: {
      // 0 - draft, 1 - active, 2 - inactive , 3 -delete
      type: Number,
      default: 0,
    },
    formSubmitted: {
      type: Boolean,
      default: false,
    },
    formStatus: [
      {
        fieldName: {
          type: String,
          default: '',
        },
        fieldStatus: [
          {
            fieldStatusValue: {
              type: String,
              default: '',
            },
            summary: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],
    formDisplayType: {
      type: String,
      default: '0',
    },
    deletedWorkflows: [
      {
        title: {
          type: String,
          required: [true, 'Please provide workflow title'],
        },
        type: {
          type: Number,
          // default: 1, // 1.Common workflow 2.Conditional workflow based on question response 3.Conditional workflow based on workflow response
          required: [true, 'Please provide workflow type'],
        },
        status: {
          type: Number,
          default: 1, // 0.deleted 1.active
        },
        additionalModuleId: {
          type: Schema.Types.ObjectId,
          ref: 'BuilderModule',
        },
        questionResponse: [
          {
            // for 2.Conditional workflow based on question response
            questionId: {
              type: String,
              required: [
                true,
                'Please select question for question response workflow',
              ],
            },
            answerId: {
              type: String,
              required: [
                true,
                'Please select answer for question response workflow',
              ],
            },
          },
        ],
        workflowResponse: [
          {
            // for 3.Conditional workflow based on workflow response
            workflowId: {
              type: String,
              // default: ''
              required: [true, 'Please select workflow for workflow response'],
            },
            statusId: {
              type: String,
              // default: ''
              required: [
                true,
                'Please select workflow status for workflow response',
              ],
            },
          },
        ],
        userStatusVisibility: {
          type: Boolean,
          default: false,
        },
        workflowStatus: {
          type: [
            {
              // current workflow status
              field: {
                type: String,
                // default: ''
                required: [true, 'Workflow status title is required'],
              },
              status: {
                type: Number,
                default: 1, // 0.deleted 1.active
              },
              isDefault: {
                type: Boolean,
                default: false,
              },
              tempId: {
                type: Number,
              },
            },
          ],
          validate: [
            (status) => !!status.length,
            'Workflow status must be an array with atleast one status',
          ],
        },
        admin: {
          type: [
            {
              type: Schema.Types.ObjectId,
              ref: 'User',
            },
          ],
          required: [true, 'admin is required'],
        },
        tempId: {
          type: Number,
        },
      },
    ],
    workflow: [
      {
        title: {
          type: String,
          required: [true, 'Please provide workflow title'],
        },
        type: {
          type: Number,
          // default: 1, // 1.Common workflow 2.Conditional workflow based on question response 3.Conditional workflow based on workflow response
          required: [true, 'Please provide workflow type'],
        },
        status: {
          type: Number,
          default: 1, // 0.deleted 1.active
        },
        additionalModuleId: {
          type: Schema.Types.ObjectId,
          ref: 'BuilderModule',
        },
        questionResponse: [
          {
            // for 2.Conditional workflow based on question response
            questionId: {
              type: String,
              required: [
                true,
                'Please select question for question response workflow',
              ],
            },
            answerId: {
              type: String,
              required: [
                true,
                'Please select answer for question response workflow',
              ],
            },
          },
        ],
        workflowResponse: [
          {
            // for 3.Conditional workflow based on workflow response
            workflowId: {
              type: String,
              // default: ''
              required: [true, 'Please select workflow for workflow response'],
            },
            statusId: {
              type: String,
              // default: ''
              required: [
                true,
                'Please select workflow status for workflow response',
              ],
            },
          },
        ],
        userStatusVisibility: {
          type: Boolean,
          default: false,
        },
        workflowStatus: {
          type: [
            {
              // current workflow status
              field: {
                type: String,
                // default: ''
                required: [true, 'Workflow status title is required'],
              },
              status: {
                type: Number,
                default: 1, // 0.deleted 1.active
              },
              color: {
                type: String,
                required: true,
              },
              isDefault: {
                type: Boolean,
                default: false,
              },
              tempId: {
                type: Number,
              },
            },
          ],
          validate: [
            (status) => !!status.length,
            'Workflow status must be an array with atleast one status',
          ],
        },
        admin: {
          type: [
            {
              type: Schema.Types.ObjectId,
              ref: 'User',
            },
          ],
          required: [true, 'admin is required'],
        },
        tempId: {
          type: Number,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Indexes
CustomFormSchema.index({ createdBy: 1 });
CustomFormSchema.index({ formName: 1 });

module.exports = mongoose.model('Customform', CustomFormSchema);
