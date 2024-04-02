// Controller Code Starts here
const mongoose = require('mongoose');
const moment = require('moment');
const fs = require('fs');
const { validationResult } = require('express-validator');
const json2csv = require('json2csv').parse;
const FCM = require('../../../helpers/fcm');
const BuilderModule = require('../../models/builderModule');
const QuestionResponse = require('../../models/questionResponse');
const CustomForm = require('../../models/customForms');
const Company = require('../../models/company');
const User = require('../../models/user');
const ManageForm = require('../../models/manageForm');
const ManageAdminForm = require('../../models/manageAdminForm');
const FormSetting = require('../../models/formsettings');
const questionModule = require('../common/questionModuleController');
const MyBoardController = require('../common/myBoardController');
const ManageFormLog = require('../../models/manageFormLog');
// PDFDocument = require('pdfkit'),
const challengeController = require('../common/challengeController');
const { AssignUserRead } = require('../../../helpers/assinguserread');
const __ = require('../../../helpers/globalFunctions');

// PDFDocument = require('../../../helpers/pdfkit-table');

class CustomformController {
  isObject(obj) {
    return (
      (typeof obj === 'object' && obj !== null) || typeof obj === 'function'
    );
  }

  // Add Custom Form .....
  async createForm(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const escapedName = req.body.title
        .trim()
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

      const alreadyExistWithSameName = await CustomForm.findOne({
        title: {
          $regex: `^${escapedName}$`,
          $options: 'i',
        },
        _id: { $nin: [req.body._id] },
        createdBy: req.user._id,
      }).lean();

      if (alreadyExistWithSameName) {
        return __.out(res, 300, 'Form name already exists');
      }

      const reqFields = [
        'title',
        'isDeployed',
        'assignUsers',
        'moduleId',
        'formLogo',
        'description',
      ];
      const requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'customform',
      );

      if (!requiredResult.status) {
        return __.out(res, 300, requiredResult.missingFields);
      }

      if (!__.checkSpecialCharacters(req.body, 'customforms')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      let data = req.body;

      data.createdBy = req.user._id;
      data.quickNavEnabled = req.body.quickNavEnabled;
      data.companyId = req.user.companyId;
      data.assignUsers = data.assignUsers || [];
      if (req.body.description && req.body.description.length > 200) {
        return __.out(res, 300, `Description should be with in 200 characters`);
      }

      if (data.moduleId) {
        const moduleData = await __.isModuleIncluded(data.moduleId, [data._id]);

        if (!moduleData.status) {
          return __.out(res, 300, moduleData.message);
        }

        data.moduleIncluded = moduleData.status;
      } else {
        data.moduleIncluded = false;
      }

      const forExternalForm = async (data1) => {
        data1.formName = data1.title.replace(/ /g, '');
        const condition = {
          formName: data1.formName,
        };

        if (data1._id) {
          condition._id = {
            $nin: [data1._id],
          };
        }

        const isExist = await CustomForm.findOne(condition).lean();

        if (isExist) {
          return false;
          // return __.out(res, 300, 'Form name already exist');
        }

        if (data1.isDeployed === 2) {
          const userData = await User.findOne({ _id: req.user._id, status: 1 })
            .populate({ path: 'companyId', select: 'pathName' })
            .lean();

          // context = `${formData.companyData.url}${formId}`;
          data1.formUrl = `${userData.companyId.pathName}/external-link/${data1.formName}`;
        }

        return data1;
      };

      const users = await AssignUserRead.read(
        data.assignUsers,
        null,
        req.user._id,
      );

      if (data.isDeployed !== 2 && data.status === 1 && !users.users.length) {
        return __.out(res, 300, `No users found with these user details`);
      }

      if (data.isDeployed === 2) {
        const result = await forExternalForm(data);

        if (result) {
          data = { ...result };
        } else {
          return __.out(res, 300, 'Form name already exist');
        }
      }

      // const validateOrModifyData = (formData, customform) => {
      //   let message;

      //   if (
      //     !!formData.moduleId &&
      //     customform.moduleId.toString() !== formData.moduleId.toString()
      //   )
      //     message = 'Module is not changeable';

      //   if (
      //     !!formData.additionalModuleId &&
      //     customform.additionalModuleId &&
      //     customform.additionalModuleId.toString() !==
      //       formData.additionalModuleId.toString()
      //   )
      //     message = 'Additional Module is not changeable';

      //   if (message) {
      //     return { status: 0, message };
      //   }

      //   return null;
      // };
      const manageType3Workflows = async (customForm) => {
        const ids = {};

        customForm.workflow.forEach((e) => {
          const statusIds = {};

          e.workflowStatus.forEach((s) => {
            statusIds[s.tempId] = s._id;
          });
          ids[e.tempId] = {
            _id: e._id,
            statusIds,
          };
        });
        const type3Workflows = customForm.workflow.filter(
          (workflow) => workflow.type === 3,
        );
        let isUpdateRequired = false;

        type3Workflows.forEach((workflow) => {
          workflow.workflowResponse.forEach((e) => {
            if (ids[e.workflowId]) {
              e.statusId = ids[e.workflowId].statusIds[e.statusId];
              e.workflowId = ids[e.workflowId]._id;
              isUpdateRequired = true;
            }
          });
        });
        if (customForm.workflow) {
          customForm.workflow.forEach((w) => (w._id ? null : delete w._id));
        }

        if (isUpdateRequired) {
          await CustomForm.findOneAndUpdate(
            {
              _id: customForm._id,
            },
            {
              $set: customForm,
            },
            {
              setDefaultsOnInsert: true,
            },
          );
        }
      };

      if (data._id) {
        let customForm = await CustomForm.findById(data._id).lean();

        customForm = JSON.parse(JSON.stringify(customForm));
        const statusBeforeUpdate = parseInt(customForm.status, 10);

        // const data2 = await validateOrModifyData(data, customForm);
        // if (!!data2 && data2.status === 0) {
        //     return __.out(res, 300, data2.message);
        // }
        if (customForm) {
          let findObj = {
            _id: customForm._id,
            companyId: req.user.companyId,
          };

          if (customForm.formStatus && customForm.formStatus.length > 0) {
            findObj = { ...findObj, 'assignUsers.admin': req.user._id };
          }

          if (data.workflow) {
            data.workflow.forEach((w) => (w._id ? null : delete w._id));
          }

          const inputExistingWFs = data.workflow.filter((wf) => !!wf._id);
          const deletedWorkflows = customForm.workflow.reduce((dwf, wf) => {
            if (
              !inputExistingWFs.find(
                (w) => w._id.toString() === wf._id.toString(),
              )
            ) {
              dwf.push(wf);
            }

            return dwf;
          }, []);

          data.deletedWorkflows = deletedWorkflows;
          customForm = await CustomForm.findOneAndUpdate(
            findObj,
            {
              $set: data,
            },
            {
              setDefaultsOnInsert: true,
            },
          );
          if (statusBeforeUpdate !== 1 && data.status === 1) {
            //  publishing saved form
            this.createFormPushNotification(data, req.body.timeZone, res);
          }

          manageType3Workflows(customForm);
          return __.out(res, 201, { message: 'Form Successfully updated' });
        }

        return __.out(res, 300, `Customform not found`);
      }

      if (data._id === null) delete data._id;

      if (data.workflow) {
        data.workflow.forEach((w) => (w._id ? null : delete w._id));
      }

      const customForm = await (await new CustomForm(data).save()).toObject();

      manageType3Workflows(customForm);
      if (data.status === 1) {
        this.createFormPushNotification(customForm, req.body.timeZone, res);
      }

      return __.out(res, 201, { message: 'Form Created Successfully' });
    } catch (error) {
      if (
        !!error.errors &&
        !!Object.keys(error.errors).length &&
        error.errors[Object.keys(error.errors)[0]]
      ) {
        return __.out(
          res,
          300,
          error.errors[Object.keys(error.errors)[0]].message,
        );
      }

      __.log(error, 'createForm');
      return __.out(res, 300, `Something went wrong try later`);
    }
  }

  // Update Custom Form .....
  async updateForm(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const reqFields = ['customFormId'];
      const requiredResult = await __.checkRequiredFields(
        req,
        reqFields,
        'customform',
      );

      if (!requiredResult.status) {
        return __.out(res, 300, requiredResult.missingFields);
      }

      if (!__.checkSpecialCharacters(req.body, 'customforms')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      const where = {
        _id: req.body.customFormId,
        companyId: req.user.companyId,
        // 'formStatus._id': req.body._id,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      const customFormCheck = await CustomForm.findOne({
        _id: req.body.customFormId,
        companyId: req.user.companyId,
      })
        .select('workflow formStatus')
        .lean();

      if (!!customFormCheck.workflow && !!customFormCheck.workflow.length) {
        delete where.assignUsers;
        where.workflow = {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        };
      }

      const data = {};

      if ('formStatus' in req.body) {
        data.formStatus = req.body.formStatus || [];
      }

      if ('status' in req.body) {
        data.status = req.body.status;
        if ([1, 2].indexOf(data.status) === -1) {
          return __.out(res, 300, { message: 'Invalid Status' });
        }
      }

      if ('userStatusVisibility' in req.body) {
        data.userStatusVisibility = !!req.body.userStatusVisibility;
      }

      // CustomForm Update ....
      if ('status' in req.body || 'userStatusVisibility' in req.body) {
        const customFormData = await CustomForm.findOneAndUpdate(
          where,
          {
            $set: data,
          },
          {
            setDefaultsOnInsert: true,
          },
        ).lean();

        if (!customFormData) {
          return __.out(res, 300, { message: 'Custom FormData not found' });
        }
      }

      if ('fieldStatus' in req.body || 'statusFilter' in req.body) {
        let resultt = await this.setFormSettings(req, res, true);

        if (resultt) {
          req.params = req.body;
          resultt = await this.getFormSettings(req, res, true);
          if (Object.keys(resultt).length === 2) {
            return __.out(res, 201, resultt);
          }

          return __.out(res, 300, {
            message: 'Something went wrong while get Form settings',
          });
        }
      }

      return __.out(res, 201, { message: 'Updated Successfully!' });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async readFormsList(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { companyId } = req.params;
      const company = await Company.findById(companyId).lean();

      if (!company) {
        return __.out(res, 404, 'Company not found!');
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const draw = req.query.draw || 0;
      // let query = {
      //     status: {
      //         $nin: [3]
      //     },
      //     assignUsers: {
      //         $elemMatch: {
      //             admin: {
      //                 $in: [req.user._id]
      //             }
      //         }
      //     },
      // };
      const query = {
        $or: [
          {
            companyId,

            $or: [{ workflow: { $exists: false } }, { workflow: { $size: 0 } }],

            status: {
              $nin: [0, 3],
            },
            assignUsers: {
              $elemMatch: {
                admin: {
                  $in: [req.user._id],
                },
              },
            },
          },
          {
            companyId,
            workflow: { $exists: true },
            status: {
              $nin: [0, 3],
            },
          },
          {
            status: 0,
            createdBy: req.user._id,
          },
        ],
      };
      const recordsTotal = await CustomForm.count(query).lean();
      let recordsFiltered = recordsTotal;

      if (!!req.query.search && req.query.search.value) {
        let user = await User.find({
          name: {
            $regex: `${req.query.search.value}`,
            $options: 'is',
          },
        })
          .select('_id')
          .lean();

        if (!!user && user.length) {
          user = user.map((v) => v._id);
        }

        // query["$or"] = [
        const q = [
          {
            title: {
              $regex: `${req.query.search.value}`,
              $options: 'is',
            },
          },
          {
            createdBy: {
              $in: user,
            },
          },
        ];

        query.$or[0].$and.push({ $or: q });
        query.$or[1].$or = q;
        query.$or[2].$or = q;
        delete query.$or[2].createdBy;
        recordsFiltered = await CustomForm.count(query).lean();
      }

      const sort = {};

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            case '2':
              sort.isDeployed = getSort(orderData[i].dir);
              break;

            case '3':
              sort.createdBy = getSort(orderData[i].dir);
              break;

            case '4':
              sort.status = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const data = await CustomForm.find(query)
        .populate([
          {
            path: 'assignUsers.businessUnits',
            select: 'orgName status',
          },
          {
            path: 'assignUsers.appointments',
            select: 'name',
          },
          {
            path: 'assignUsers.subSkillSets',
            select: 'name status',
            match: {
              status: 1,
            },
            populate: {
              path: 'skillSetId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
          },
          {
            path: 'assignUsers.user',
            select: 'name staffId',
          },
          {
            path: 'assignUsers.admin',
            select: 'name staffId',
          },
          {
            path: 'moduleId',
            select: 'moduleName questions',
            populate: {
              path: 'questions',
            },
          },
          {
            path: 'workflow.additionalModuleId',
            select: 'moduleName questions',
            populate: {
              path: 'questions',
            },
          },
          {
            path: 'workflow.admin',
            select: 'name staffId',
          },
          {
            path: 'createdBy',
            select: 'name',
          },
        ])
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      const statusFilter = await FormSetting.find({
        createdBy: req.user._id,
        formId: { $in: data.map((d) => d._id) },
      })
        .select('statusFilter formId')
        .lean();

      data.forEach((form) => {
        if (form.workflow) {
          form.workflow.forEach((wf) => {
            wf.isAdmin = !!wf.admin.find(
              (adm) => adm._id.toString() === req.user._id.toString(),
            );
          });
        }
      });

      statusFilter.forEach((s) => {
        const foundData = data.find(
          (d) => d._id.toString() === s.formId.toString(),
        );

        if (foundData) {
          foundData.statusFilter = s.statusFilter;
        }
      });

      return res
        .status(201)
        .json({ draw, recordsTotal, recordsFiltered, data });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Read  the Custom Form Data ...
  async readCustomForm(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        status: {
          $nin: [3],
        },
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
        moduleIncluded: true,
      };

      if (req.query.status) {
        where.status = req.query.status;
      }

      /** old code */
      // module linked with wall post
      const linkedModuleData = await CustomForm.find(where)
        .populate({
          path: 'assignUsers.businessUnits',
          select: 'name status sectionId',
          populate: {
            path: 'sectionId',
            select: 'name status departmentId',
            populate: {
              path: 'departmentId',
              select: 'name status companyId',
              populate: {
                path: 'companyId',
                select: 'name status',
              },
            },
          },
        })
        .populate({
          path: 'assignUsers.appointments',
          select: 'name',
        })
        .populate({
          path: 'assignUsers.subSkillSets',
          select: 'name status',
          match: {
            status: 1,
          },
          populate: {
            path: 'skillSetId',
            select: 'name status',
            match: {
              status: 1,
            },
          },
        })
        .populate({
          path: 'assignUsers.user',
          select: 'name staffId',
        })
        .populate({
          path: 'assignUsers.admin',
          select: 'name staffId',
        })
        .populate({
          path: 'createdBy',
          select: 'name',
        })
        .lean();

      return __.out(res, 201, {
        data: linkedModuleData,
      });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // read forms and myforms for mobile
  async readFormsandMyforms(req, res, quickNav = false) {
    try {
      const data = await AssignUserRead.getUserInAssignedUser(
        req.user,
        CustomForm,
      );
      let allData = await CustomForm.find({
        $or: [
          { _id: { $in: data } },
          {
            $and: [
              { companyId: req.user.companyId },
              { status: 1 },
              { isDeployed: 2 },
            ],
          },
        ],
      })
        .populate([
          {
            path: 'moduleId',
            select: 'questions',
            populate: {
              path: 'questions',
              select: 'question _id imageSrc ppimageuploadfrom options type',
            },
          },
          {
            path: 'workflow.additionalModuleId',
            populate: {
              path: 'questions',
              select: 'question _id imageSrc ppimageuploadfrom options type',
            },
          },
        ])
        .lean();
      let customFields = req.user.otherFields || [];

      customFields = customFields.map((v) => ({
        fieldId: v.fieldId,
        value: v.value,
      }));
      const userId = req.user._id;
      const userAppointment = req.user.appointmentId;
      const userSubSkillSets = req.user.subSkillSets || [];

      allData.forEach((form) => {
        let isManageable = !!form.assignUsers.filter((user) =>
          user.admin.find(
            (adminUser) => adminUser.toString() === userId.toString(),
          ),
        ).length;

        if (!!form.workflow && !!form.workflow.length) {
          isManageable = !!form.workflow.filter((user) =>
            user.admin.find(
              (adminUser) => adminUser.toString() === userId.toString(),
            ),
          ).length;
        }

        let isSubmittable = !isManageable;

        /*
         * If form active & manageable - considering is_submittable in if statement (below)
         * If form active & not manageable - is_submittable is true
         * If form inactive & manageable - is_submittable forcefully set to false in else part (below)
         * If form inactive & not manageable - is_submittable forcefully set to false in else part (below)
         */
        if (isManageable && form.status === 1) {
          const cb = (assignUsers) => ({
            customField: assignUsers.customField.find((field) =>
              customFields.find(
                (cField) =>
                  cField.fieldId === field.fieldId &&
                  cField.value === field.value,
              ),
            ),
            user: assignUsers.user.find(
              (auser) => auser.toString() === userId.toString(),
            ),
            subSkillSets: assignUsers.subSkillSets.find((subSkill) =>
              userSubSkillSets.find((userSubSkill) =>
                userSubSkill.toString() === subSkill ? subSkill.toString() : '',
              ),
            ),
            appointments: assignUsers.appointments.find(
              (appointment) =>
                appointment.toString() === userAppointment.toString(),
            ),
          });

          isSubmittable = !!form.assignUsers.find(
            (condition) =>
              (condition.customField.length === 0 &&
                condition.user.length === 0 &&
                condition.subSkillSets.length === 0 &&
                condition.appointments.length === 0) ||
              (condition.buFilterType === 1 &&
                (!!cb(condition).customField ||
                  !!cb(condition).subSkillSets ||
                  !!cb(condition).appointments)) ||
              (condition.buFilterType === 2 &&
                (!!cb(condition).customField ||
                  !!cb(condition).subSkillSets ||
                  !!cb(condition).user ||
                  !!cb(condition).appointments)) ||
              (condition.buFilterType === 3 &&
                !cb(condition).customField &&
                !cb(condition).subSkillSets &&
                !cb(condition).user &&
                !cb(condition).appointments),
          );
        } else if (form.status === 2) {
          isSubmittable = false;
        }

        // delete form.assignUsers;
        form.is_manageable = isManageable;
        form.is_submittable =
          isSubmittable || (isManageable && form.isDeployed === 2);
        if (form.workflow)
          form.workflow.forEach((wf) => {
            wf.isAdmin = !!wf.admin.find(
              (adm) => adm.toString() === req.user._id.toString(),
            );
          });
      });
      allData = allData.filter((d) => d.is_manageable || d.is_submittable);
      if (quickNav) {
        // getting forms for quicknav mobile
        allData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const forms = allData
          .filter((form) => form.quickNavEnabled)
          .slice(0, 10);
        // getting boards for quicknav mobile
        let boards = await MyBoardController.getWalls(req, res, true);

        boards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        boards = boards.slice(0, 10);
        return __.out(res, 201, { forms, boards });
      }

      const statusFilter = await FormSetting.find({
        createdBy: req.user._id,
        formId: { $in: allData.map((d) => d._id) },
      })
        .select('statusFilter fieldStatus formId')
        .lean();

      statusFilter.forEach((s) => {
        allData.find(
          (d) => d._id.toString() === s.formId.toString(),
        ).statusFilter = s.statusFilter;
        allData.find(
          (d) => d._id.toString() === s.formId.toString(),
        ).fieldStatus = s.fieldStatus;
      });
      /* if(+req.query.m === 1) {
                return res.status(201).json(data);
            } else { */

      allData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return __.out(res, 201, { data: allData });
      // }
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // read myform data
  async readCustomForms(req, res) {
    try {
      const data = await AssignUserRead.getUserInAssignedUser(
        req.user,
        CustomForm,
      );
      const allData = await CustomForm.find({ _id: { $in: data } });

      allData.sort((a, b) => b.updatedAt - a.updatedAt);
      const response = {
        data: allData,
      };

      return __.out(res, 201, response);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // Update Custom Manage Form .....

  async updateManageForm(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      if (!__.checkSpecialCharacters(req.body, 'manageforms')) {
        return __.out(
          res,
          300,
          `You've entered some excluded special characters`,
        );
      }

      const where = {
        _id: req.body._id,
        companyId: req.user.companyId,
        assignUsers: {
          $elemMatch: {
            admin: {
              $in: [req.user._id],
            },
          },
        },
      };
      let context;

      if (req.body.isDeployed === 2) {
        const userData = await User.findOne({
          _id: req.user._id,
          status: 1,
        })
          .populate({
            path: 'companyId',
            select: 'name email logo pathName',
          })
          .lean();
        /* formToken = jwt.sign({
                    _id: userData._id,
                    loggedIn: userData.loggedIn
                }, process.env.API_KEY, {
                        expiresIn: '365d'
                    }), */
        const formData = {
          userName: userData.name,
          userEmail: userData.email,
          staffId: userData.staffId,
          // formToken: formToken,
          companyData: userData.companyId,
          formId: req.body._id,
        };
        const formId = Buffer.from(formData.formId).toString('base64');

        formData.companyData.url = `${formData.companyData.pathName}#!/external-link/`;
        context = `${formData.companyData.url}${formId}`;
      }

      // CustomForm Update ....
      const customFormData = await CustomForm.findOneAndUpdate(
        where,
        {
          $set: {
            title: req.body.title,
            companyId: req.user.companyId,
            isDeployed: req.body.isDeployed,
            viewOnly: req.body.viewOnly,
            formStatus: req.body.formStatus || [],
            assignUsers: req.body.assignUsers,
            status: req.body.status,
            statusFormType: req.body.statusFormType || 0,
            createdBy: req.user._id,
            moduleIncluded: req.body.moduleIncluded || true,
            moduleId: req.body.moduleId,
            formUrl: context,
          },
        },
        {
          setDefaultsOnInsert: true,
        },
      ).lean();

      if (!customFormData) {
        return __.out(res, 300, 'Custom FormData not found');
      }

      return __.out(res, 201, 'Updated Successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  // read external customform data

  async readExternalCustomFormData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const customFormId = Buffer.from(
        req.body.customFormId,
        'base64',
      ).toString('ascii');
      // module linked with CustomForm
      const linkedModuleData = await CustomForm.findOne({
        _id: customFormId,
      })
        .populate({
          path: 'moduleId',
          select: 'questions',
          populate: {
            path: 'questions',
            select:
              'question type options value dateTime maxlength explanation conditionalQuestions profile required',
            // populate:{
            //     path:'conditionalQuestions.questionId'
            // }
          },
        })
        .lean();

      return __.out(res, 201, {
        data: linkedModuleData,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  // read external customform data
  async readCustomFormData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // module linked with CustomForm
      const linkedModuleData = await CustomForm.findOne({
        _id: req.body.customFormId,
      })
        .populate({
          path: 'moduleId',
          select: 'questions',
          populate: {
            path: 'questions',
          },
        })
        .lean();

      return __.out(res, 201, {
        data: linkedModuleData,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  // upload the file
  async uploadContentFiles(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      __.scanFile(
        req.file.filename,
        `public/uploads/customForm/${req.file.filename}`,
      );
      const storePath = `uploads/customForm/${req.file.filename}`;
      const filePath = `${__.serverBaseUrl()}${storePath}`;

      return res.status(201).send({
        link: filePath,
        filePath: storePath,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  async readManageforms(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { customFormId } = req.params;

      // Object.assign(req.query, req.body);
      req.query = { ...req.query, ...req.body };
      const { fromDate, toDate, parentBussinessUnitId } = req.query;
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      let query = { customFormId: mongoose.Types.ObjectId(customFormId) };

      if (fromDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = moment(fromDate).utc().startOf('day').toDate();
      }

      if (toDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = moment(toDate).utc().endOf('day').toDate();
      }

      const customForm = await CustomForm.findById(customFormId)
        .select({
          formStatus: 1,
          workflow: 1,
          moduleId: 1,
          isDeployed: 1,
        })
        .lean();
      const isStatusExists =
        !!customForm.formStatus && !!customForm.formStatus.length;
      const workflowIds =
        !!customForm.workflow && !!customForm.workflow.length
          ? customForm.workflow
              .filter((flow) =>
                flow.admin
                  .map((admin) => admin.toString())
                  .includes(req.user._id.toString()),
              )
              .map((flow) => flow._id.toString())
          : [];

      if (workflowIds.length) {
        query.workflowStatus = {
          $elemMatch: {
            fieldId: { $in: workflowIds },
          },
        };
      }

      // const recordsTotal = await ManageForm.count(query).lean();
      // let recordsFiltered = recordsTotal;
      // if (!!req.query.search && req.query.search.value) {
      //     query["$or"] = [
      //         {
      //             'customFormId.title': {
      //                 $regex: `${req.query.search.value}`,
      //                 $options: "ixs"
      //             }
      //         }
      //     ];
      //     recordsFiltered = await ManageForm.count(query).lean();
      // }
      const sort = {};

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const userLookup = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId',
          },
        },
        { $unwind: '$userId' },
      ];

      if (parentBussinessUnitId) {
        const bufilter = {
          $match: {
            'userId.parentBussinessUnitId': mongoose.Types.ObjectId(
              parentBussinessUnitId,
            ),
          },
        };

        userLookup.push(bufilter);
      }

      const query2 = {
        customFormId: mongoose.Types.ObjectId(customFormId),
        workflowStatus: {
          $elemMatch: {
            fieldId: { $in: workflowIds },
          },
        },
      };

      query = [{ $match: query }];
      if (customForm.isDeployed !== 2) {
        query.push(...userLookup);
      }

      query.push(
        ...[
          {
            $lookup: {
              from: 'customforms',
              localField: 'customFormId',
              foreignField: '_id',
              as: 'customFormId',
            },
          },
          { $unwind: '$customFormId' },
          {
            $project: {
              createdAt: 1,
              formStatus: 1,
              workflowStatus: 1,
              questionId: 1,
              formId: 1,
              'userId._id': 1,
              'userId.name': 1,
              'customFormId.title': 1,
              'customFormId.viewOnly': 1,
            },
          },
        ],
      );
      if (/* isStatusExists &&  */ req.query.statusFilter) {
        req.query.statusFilter = req.query.statusFilter.split(',');
        // query.push({ $match: { "formStatus.fieldStatusValueId": { $in: req.query.statusFilter } }});
        query.push({
          $match: {
            $or: [
              {
                'formStatus.fieldStatusValueId': {
                  $in: req.query.statusFilter,
                },
              },
              {
                'workflowStatus.fieldStatusId': { $in: req.query.statusFilter },
              },
            ],
          },
        });
      }

      let recordsTotal = await ManageForm.aggregate(query);

      recordsTotal = recordsTotal.length;
      const recordsFiltered = recordsTotal;
      let manageForm = await ManageForm.aggregate(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      manageForm = await ManageForm.populate(manageForm, {
        path: 'questionId',
        select: { questionId: 1, answer: 1 },
      });
      let questionList = await BuilderModule.populate(
        await BuilderModule.find({ _id: customForm.moduleId }).lean(),
        {
          path: 'questions',
          select: { _id: 1, type: 1, options: 1 },
        },
      );

      questionList = JSON.parse(JSON.stringify(questionList));
      questionList = questionList[0].questions.map((q) => ({
        _id: q._id,
        type: q.type,
        options: q.options,
      }));
      let adminModulesList;
      let adminModuleResponses;

      if (!!customForm.workflow && !!customForm.workflow.length) {
        const adminModuleIds = customForm.workflow
          .map((wf) =>
            wf.additionalModuleId ? wf.additionalModuleId.toString() : '',
          )
          .filter((id) => !!id);

        adminModulesList = await BuilderModule.populate(
          await BuilderModule.find({ _id: { $in: adminModuleIds } }).lean(),
          {
            path: 'questions',
            select: { _id: 1, type: 1, options: 1 },
          },
        );

        adminModulesList = JSON.parse(JSON.stringify(adminModulesList));
        adminModulesList = adminModulesList.reduce((obj, aml, i) => {
          obj[adminModuleIds[i]] = aml.questions.map((q) => ({
            _id: q._id,
            type: q.type,
            options: q.options,
          }));
          return obj;
        }, {});
        adminModuleResponses = await ManageAdminForm.find({
          manageFormId: { $in: manageForm.map((mf) => mf._id.toString()) },
        }).lean();

        adminModuleResponses = await ManageAdminForm.populate(
          adminModuleResponses,
          {
            path: 'questionId',
            select: { questionId: 1, answer: 1 },
          },
        );
        adminModuleResponses = adminModuleResponses
          ? JSON.parse(JSON.stringify(adminModuleResponses))
          : [];
      }

      // const manageForm = await ManageForm.find(query).populate([{
      //     path: 'customFormId',
      //     select: { title: 1, _id: 0, viewOnly:1 }
      // }, {
      //     path: 'userId',
      //     select: 'name'
      // },{
      //     path:'questionId',
      //     select:'questionId answer'
      // }]).select({
      //     customFormId: 1,
      //     userId: 1,
      //     formStatus: 1,
      //     createdAt: 1
      // }).sort(sort).skip(skip).limit(limit).lean();
      const addStatusToManageForm = (single) => {
        let obj = {
          _id: single._id,
          createdAt: single.createdAt,
          formName: single.customFormId.title,
          viewOnly: !!single.customFormId.viewOnly,
          user: single.userId ? single.userId.name : '--',
          formId: single.formId || '--',
        };
        const constructObj = (questionIdInput) => {
          obj = questionIdInput.reduce((prev, curr) => {
            prev[curr.questionId] = curr.answer;
            /* const qFind = questionListt.find(ql => ql._id.toString() === curr.questionId.toString());
                        if(!!qFind && qFind.type === 16) {
                            const isTouching = ({ x, y, radious }, i) => {
                                const spot = qFind.options.map(answer => answer.coordinates)[i];
                                const {x1, y1, r1} = { x1:+x, y1:+y, r1:+radious };
                                const {x2, y2, r2} = { x2:+spot.x, y2:+spot.y, r2:+spot.radious };
                                const c1 = Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
                                // $scope.color = c1 > r1*2 ? 'red' : 'green';
                                return c1 <= r1*2;
                            }
                            const isAllCirclesAvailable = curr.answer.length === qFind.options.length;
                            const bool = curr.answer.reduce((answerFlag, answer, i) => answerFlag && isTouching(answer.coordinates, i), isAllCirclesAvailable);
                            prev[curr.questionId] = `PP-${bool?'correct':'incorrect'}`;
                        } */
            return prev;
          }, obj);
        };

        constructObj(single.questionId, questionList);
        if (!!adminModuleResponses && !!adminModuleResponses.length) {
          adminModuleResponses
            .filter(
              (adminModuleResponse) =>
                adminModuleResponse.manageFormId.toString() ===
                single._id.toString(),
            )
            .forEach((adminModuleResponse) => {
              constructObj(
                adminModuleResponse.questionId,
                adminModulesList[adminModuleResponse.moduleId.toString()],
              );
            });
        }

        if (!!customForm.workflow && !!customForm.workflow.length) {
          return customForm.workflow.reduce((prev, curr) => {
            const index = single.workflowStatus.findIndex(
              (st) => st.fieldId.toString() === curr._id.toString(),
            );

            prev[curr._id] =
              index === -1 ? null : single.workflowStatus[index].fieldStatusId;
            return prev;
          }, obj);
        }

        return customForm.formStatus.reduce((prev, curr) => {
          const index = single.formStatus.findIndex(
            (st) => st.fieldId.toString() === curr._id.toString(),
          );

          prev[curr._id] =
            index === -1 ? null : single.formStatus[index].fieldStatusValueId;
          return prev;
        }, obj);
      };
      const result = manageForm.reduce(
        (prev, single) => prev.concat(addStatusToManageForm(single)),
        [],
      );
      let groupByStatus = [];

      if (isStatusExists) {
        groupByStatus = await ManageForm.aggregate([
          {
            $match: { customFormId: mongoose.Types.ObjectId(customFormId) },
          },
          {
            $project: {
              formStatus: 1,
            },
          },
          {
            $unwind: '$formStatus',
          },
          {
            $group: {
              _id: '$formStatus.fieldStatusValueId',
              count: { $sum: 1 },
            },
          },
        ]);
      }

      // workflow status groupping
      let groupByWFStatus = [];

      if (workflowIds.length) {
        groupByWFStatus = await ManageForm.aggregate([
          {
            $match: query2,
          },
          {
            $project: {
              workflowStatus: 1,
            },
          },
          {
            $unwind: '$workflowStatus',
          },
          {
            $group: {
              _id: '$workflowStatus.fieldStatusId',
              count: { $sum: 1 },
            },
          },
        ]);
      }

      const data = {
        draw: req.query.draw || 0,
        recordsTotal: recordsTotal || 0,
        recordsFiltered: recordsFiltered || 0,
        data: { result, groupByStatus, groupByWFStatus },
      };

      return res.status(201).json(data);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async readMManageforms(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const limit = 10;
      const skip = req.body.start ? parseInt(req.body.start, 10) * limit : 0;
      const { customFormId } = req.body;
      let query = { customFormId: mongoose.Types.ObjectId(customFormId) };

      if (req.body.date) {
        const month = +req.body.date.split('-')[0];
        const year = +req.body.date.split('-')[1];

        query.createdAt = {
          $gte: new Date(moment([year, month - 1]).toLocaleString()),
          $lt: new Date(
            moment(moment([year, month - 1]))
              .endOf('month')
              .toLocaleString(),
          ),
        };
      }

      // const recordsTotal = await ManageForm.count(query).lean();
      const customForm = await CustomForm.findById(customFormId)
        .select({ formStatus: 1, workflow: 1, moduleId: 1, isDeployed: 1 })
        .lean();

      if (!customForm) {
        return __.out(res, 300, 'Customform not found');
      }

      const workflowIds =
        !!customForm.workflow && !!customForm.workflow.length
          ? customForm.workflow
              .filter((flow) =>
                flow.admin
                  .map((admin) => admin.toString())
                  .includes(req.user._id.toString()),
              )
              .map((flow) => flow._id.toString())
          : [];

      if (workflowIds.length) {
        query.workflowStatus = {
          $elemMatch: {
            fieldId: { $in: workflowIds },
          },
        };
      }

      if (!!req.body && !!req.body.q) {
        query.$or = [
          {
            'customFormId.title': {
              $regex: `${req.body.q}`,
              $options: 'is',
            },
          },
        ];
        // recordsFiltered = await ManageForm.count(query).lean();
      }

      const query2 = {
        customFormId: mongoose.Types.ObjectId(customFormId),
        workflowStatus: {
          $elemMatch: {
            fieldId: { $in: workflowIds },
          },
        },
      };
      // let recordsFiltered = recordsTotal;
      const userLookup = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId',
          },
        },
        { $unwind: '$userId' },
      ];

      query = [{ $match: query }];
      if (customForm.isDeployed !== 2) {
        query.push(...userLookup);
      }

      query.push(
        ...[
          {
            $lookup: {
              from: 'customforms',
              localField: 'customFormId',
              foreignField: '_id',
              as: 'customFormId',
            },
          },
          { $unwind: '$customFormId' },
          {
            $project: {
              createdAt: 1,
              formStatus: 1,
              workflowStatus: 1,
              questionId: 1,
              formId: 1,
              'userId._id': 1,
              'userId.name': 1,
              'userId.staffId': 1,
              'customFormId.title': 1,
              'customFormId.viewOnly': 1,
            },
          },
        ],
      );
      if (req.body.statusFilter) {
        // req.body.statusFilter = req.body.statusFilter.split(",");
        // query.push({ $match: { "formStatus.fieldStatusValueId": { $in: req.body.statusFilter } }});
        query.push({
          $match: {
            $or: [
              {
                'formStatus.fieldStatusValueId': { $in: req.body.statusFilter },
              },
              {
                'workflowStatus.fieldStatusId': { $in: req.body.statusFilter },
              },
            ],
          },
        });
      }

      const sort = {};

      if (req.body.order) {
        const orderData = req.body.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort.title = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      /* let recordsTotal = await ManageForm.aggregate(query);
            recordsTotal = recordsTotal.length;
            let recordsFiltered = recordsTotal; */
      let manageForm = await ManageForm.aggregate(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      manageForm = await ManageForm.populate(manageForm, {
        path: 'questionId',
        select: { questionId: 1, answer: 1 },
      });
      let questionList = await BuilderModule.populate(
        await BuilderModule.find({ _id: customForm.moduleId }).lean(),
        {
          path: 'questions',
          select: { _id: 1, type: 1, options: 1 },
        },
      );

      questionList = JSON.parse(JSON.stringify(questionList));
      questionList = questionList[0].questions.map((q) => ({
        _id: q._id,
        type: q.type,
        options: q.options,
      }));
      let adminModulesList;
      let adminModuleResponses;

      if (customForm.workflow.length) {
        const adminModuleIds = customForm.workflow
          .map((wf) =>
            wf.additionalModuleId ? wf.additionalModuleId.toString() : '',
          )
          .filter((id) => !!id);

        adminModulesList = await BuilderModule.populate(
          await BuilderModule.find({ _id: { $in: adminModuleIds } }).lean(),
          {
            path: 'questions',
            select: { _id: 1, type: 1, options: 1 },
          },
        );

        adminModulesList = JSON.parse(JSON.stringify(adminModulesList));
        adminModulesList = adminModulesList.reduce((obj, aml, i) => {
          obj[adminModuleIds[i]] = aml.questions.map((q) => ({
            _id: q._id,
            type: q.type,
            options: q.options,
          }));
          return obj;
        }, {});
        adminModuleResponses = await ManageAdminForm.find({
          manageFormId: { $in: manageForm.map((mf) => mf._id.toString()) },
        }).lean();

        adminModuleResponses = await ManageAdminForm.populate(
          adminModuleResponses,
          {
            path: 'questionId',
            select: { questionId: 1, answer: 1 },
          },
        );
        adminModuleResponses = adminModuleResponses
          ? JSON.parse(JSON.stringify(adminModuleResponses))
          : [];
      }

      let manageFormStaffBUs;

      if (customForm.isDeployed !== 2) {
        const manageFormStaffIds = manageForm
          .map((mf) => mf.userId)
          .map((mf) => mf.staffId)
          .filter((x, i, a) => a.indexOf(x) === i);

        manageFormStaffBUs = await User.find({
          staffId: { $in: manageFormStaffIds },
          companyId: req.user.companyId,
        })
          .select(`staffId parentBussinessUnitId`)
          .populate([
            {
              path: 'parentBussinessUnitId',
              select: 'name',
              populate: {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    select: 'name',
                  },
                },
              },
            },
          ])
          .lean();

        manageFormStaffBUs = manageFormStaffBUs.reduce((obj, elem) => {
          const elemm = elem.parentBussinessUnitId;

          obj[
            elem.staffId
          ] = `${elemm.sectionId.departmentId.companyId.name}>${elemm.sectionId.departmentId.name}>${elemm.sectionId.name}>${elemm.name}`;
          return obj;
        }, {});
      }

      /* const manageForm = await ManageForm.find(query).populate([{
                path: 'customFormId',
                select: { title: 1, _id: 0, viewOnly:1 }
            }, {
                path: 'userId',
                select: 'name'
            },{
                path:'questionId',
                select:'questionId answer'
            }]).select({
                customFormId: 1,
                userId: 1,
                formStatus: 1,
                createdAt: 1
            }).skip(skip).limit(limit).lean(); */
      const addStatusToManageForm = (single) => {
        let obj = {
          _id: single._id,
          createdAt: single.createdAt,
          formName: single.customFormId.title,
          viewOnly: !!single.customFormId.viewOnly,
          user: single.userId ? single.userId.name : '--',
          staffId: single.userId ? single.userId.staffId : '--',
          parentBU:
            single.userId && single.userId.staffId
              ? manageFormStaffBUs[single.userId.staffId]
              : '--',
          formId: single.formId || '--',
        };
        const constructObj = (questionIdInput) => {
          obj = questionIdInput.reduce((prev, curr) => {
            prev[curr.questionId] = curr.answer;
            /* const qFind = questionListt.find(ql => ql._id.toString() === curr.questionId.toString());
                        if(!!qFind && qFind.type === 16) {
                            const isTouching = ({ x, y, radious }, i) => {
                                const spot = qFind.options.map(answer => answer.coordinates)[i];
                                const {x1, y1, r1} = { x1:+x, y1:+y, r1:+radious };
                                const {x2, y2, r2} = { x2:+spot.x, y2:+spot.y, r2:+spot.radious };
                                const c1 = Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
                                // $scope.color = c1 > r1*2 ? 'red' : 'green';
                                return c1 <= r1*2;
                            }
                            const isAllCirclesAvailable = curr.answer.length === qFind.options.length;
                            const bool = curr.answer.reduce((answerFlag, answer, i) => answerFlag && isTouching(answer.coordinates, i), isAllCirclesAvailable);
                            prev[curr.questionId] = `PP-${bool?'correct':'incorrect'}`;
                        } */
            return prev;
          }, obj);
        };

        constructObj(single.questionId, questionList);
        if (!!adminModuleResponses && !!adminModuleResponses.length) {
          adminModuleResponses
            .filter(
              (adminModuleResponse) =>
                adminModuleResponse.manageFormId.toString() ===
                single._id.toString(),
            )
            .forEach((adminModuleResponse) => {
              constructObj(
                adminModuleResponse.questionId,
                adminModulesList[adminModuleResponse.moduleId.toString()],
              );
            });
        }

        if (customForm.workflow.length) {
          return customForm.workflow.reduce((prev, curr) => {
            const index = single.workflowStatus.findIndex(
              (st) => st.fieldId.toString() === curr._id.toString(),
            );

            prev[curr._id] =
              index === -1 ? null : single.workflowStatus[index].fieldStatusId;
            return prev;
          }, obj);
        }

        return customForm.formStatus.reduce((prev, curr) => {
          const index = single.formStatus.findIndex(
            (st) => st.fieldId.toString() === curr._id.toString(),
          );

          prev[curr._id] =
            index === -1 ? null : single.formStatus[index].fieldStatusValueId;
          return prev;
        }, obj);
      };
      const result = manageForm.reduce(
        (prev, single) => prev.concat(addStatusToManageForm(single)),
        [],
      );
      const groupByStatus = await ManageForm.aggregate([
        {
          $match: { customFormId: mongoose.Types.ObjectId(customFormId) },
        },
        {
          $project: {
            formStatus: 1,
          },
        },
        {
          $unwind: '$formStatus',
        },
        {
          $group: {
            _id: '$formStatus.fieldStatusValueId',
            count: { $sum: 1 },
          },
        },
      ]);
      // workflow status groupping
      let groupByWFStatus = [];

      if (workflowIds.length) {
        groupByWFStatus = await ManageForm.aggregate([
          {
            $match: query2,
          },
          {
            $project: {
              workflowStatus: 1,
            },
          },
          {
            $unwind: '$workflowStatus',
          },
          {
            $group: {
              _id: '$workflowStatus.fieldStatusId',
              count: { $sum: 1 },
            },
          },
        ]);
      }

      return res.status(201).json({ result, groupByStatus, groupByWFStatus });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // mobile myforms->view
  async readOwnSubmittedForms(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const limit = 10;
      const skip = parseInt(req.query.start, 10) || 0;

      const query = {
        customFormId: mongoose.Types.ObjectId(req.query.customFormId),
        userId: req.user._id,
      };

      // const customForm = await CustomForm.findById(req.query.customFormId).select({formStatus: 1}).lean();

      if (!!req.query && !!req.query.q) {
        query.$or = [
          {
            'customFormId.title': {
              $regex: `${req.query.q}`,
              $options: 'is',
            },
          },
        ];
      }

      const manageForm = await ManageForm.find(query)
        .populate([
          {
            path: 'customFormId',
            select: { title: 1, _id: 0 },
          },
          {
            path: 'userId',
            select: 'name',
          },
        ])
        .select({
          customFormId: 1,
          userId: 1,
          formStatus: 1,
          formId: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .skip(skip)
        .limit(limit)
        .lean();
      /* const addStatusToManageForm = single => {
                return {
                    _id: single._id,
                    createdAt: single.createdAt,
                    formName: single.customFormId.title,
                    viewOnly: !!single.customFormId.viewOnly,
                    user: single.userId?single.userId.name:'--'
                };
            }
            const result = manageForm.reduce((prev, single, i) => {
                return prev.concat(addStatusToManageForm(single));
            }, []); */
      const groupByStatus = await ManageForm.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId(req.query.customFormId),
            userId: req.user._id,
          },
        },
        {
          $project: {
            formStatus: 1,
          },
        },
        {
          $unwind: '$formStatus',
        },
        {
          $group: {
            _id: '$formStatus.fieldStatusValueId',
            count: { $sum: 1 },
          },
        },
      ]);

      return res.status(201).json({ data: manageForm, groupByStatus });
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // get manage form data..
  async getManageFormData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      // module linked with CustomForm
      const manageFormData = await QuestionResponse.find({
        customFormId: req.body.customFormId,
      })
        .populate({
          path: 'customFormId',
          select: 'formStatus',
        })
        .populate({
          path: 'userId',
          select: 'name',
        })
        .select('_id updatedAt formStatus')
        .lean();

      if (!manageFormData) {
        return __.out(res, 300, {
          message: 'No data available',
        });
      }

      const array = [];
      const dataValues = [];

      for (const data of manageFormData) {
        if (array.indexOf(data.userId._id) === -1) {
          array.push(data.userId._id);
          dataValues.push(data);
        }
      }
      return __.out(res, 201, {
        data: dataValues,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async readManageFormLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      const aggregateQuery = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $lookup: {
            from: 'manageforms',
            localField: 'manageFormId',
            foreignField: '_id',
            as: 'manageForm',
          },
        },
        {
          $unwind: '$manageForm',
        },
        {
          $lookup: {
            from: 'customforms',
            localField: 'manageForm.customFormId',
            foreignField: '_id',
            as: 'customForm',
          },
        },
        {
          $unwind: '$customForm',
        },
      ];

      if (req.query.search) {
        if (req.query.search.value) {
          const searchCondition = {
            $regex: `${req.query.search.value}`,
            $options: 'i',
          };

          query.$or = [
            {
              changeMessage: searchCondition,
            },
            {
              'user.name': searchCondition,
            },
            {
              'user.staffId': searchCondition,
            },
            {
              'customForm.title': searchCondition,
            },
          ];
        }
      }

      const sort = {};
      const getSort = (val) => (val === 'asc' ? 1 : -1);

      if (req.query.order) {
        const orderData = req.query.order;

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.createdAt = getSort(orderData[i].dir);
              break;

            case '1':
              sort[`customForm.title`] = getSort(orderData[i].dir);
              break;

            case '2':
              sort[`user.name`] = getSort(orderData[i].dir);
              break;

            default:
              sort.changeMessage = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const [manageFormlog, totalRecords] = await Promise.all([
        ManageFormLog.aggregate([
          { $match: query },
          {
            $sort: sort,
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
          ...aggregateQuery,
          {
            $project: {
              'user.name': 1,
              'user.staffId': 1,
              'customForm.title': 1,
              changeMessage: 1,
              changeType: 1,
              createdAt: 1,
              userName: 1,
            },
          },
        ]),
        ManageFormLog.countDocuments(query),
      ]);

      manageFormlog.forEach((mform) => {
        if (mform.userName === 'DONOTCHANGE') {
          delete mform.user.name;
          delete mform.user.staffId;
        }
      });
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords,
        data: manageFormlog,
      };

      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async readMManageFormLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = 10;
      const skip = pageNum * limit;
      const query = {
        manageFormId: mongoose.Types.ObjectId(req.params.manageFormId),
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      const aggregateQuery = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $lookup: {
            from: 'manageforms',
            localField: 'manageFormId',
            foreignField: '_id',
            as: 'manageForm',
          },
        },
        {
          $unwind: '$manageForm',
        },
        {
          $lookup: {
            from: 'customforms',
            localField: 'manageForm.customFormId',
            foreignField: '_id',
            as: 'customForm',
          },
        },
        {
          $unwind: '$customForm',
        },
      ];
      const manageFormlog = await ManageFormLog.aggregate([
        ...aggregateQuery,
        { $match: query },
        {
          $project: {
            userName: '$user.name',
            staffId: '$user.staffId',
            changeMessage: 1,
            changeType: 1,
            createdAt: 1,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]).allowDiskUse(true);

      __.log(query);
      const result = {
        manageFormlog,
      };

      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async readManageFormStatusLog(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {
        manageFormId: mongoose.Types.ObjectId(req.params.manageFormId),
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      };
      const aggregateQuery = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $lookup: {
            from: 'manageforms',
            localField: 'manageFormId',
            foreignField: '_id',
            as: 'manageForm',
          },
        },
        {
          $unwind: '$manageForm',
        },
        {
          $lookup: {
            from: 'customforms',
            localField: 'manageForm.customFormId',
            foreignField: '_id',
            as: 'customForm',
          },
        },
        {
          $unwind: '$customForm',
        },
      ];
      const totalRecords = await ManageFormLog.aggregate([
        { $match: query },
        ...aggregateQuery,
        { $group: { _id: null, count: { $sum: 1 } } },
      ]).allowDiskUse(true);

      if (req.query.search) {
        if (req.query.search.value) {
          const searchCondition = {
            $regex: `${req.query.search.value}`,
            $options: 'i',
          };

          query.$or = [
            {
              changeMessage: searchCondition,
            },
            {
              'user.staffId': searchCondition,
            },
            {
              'user.name': searchCondition,
            },
          ];
        }
      }

      const sort = {};
      const getSort = (val) => (val === 'asc' ? 1 : -1);

      if (req.query.order) {
        const orderData = req.query.order;

        for (let i = 0; i < orderData.length; i += 1) {
          switch (orderData[i].column) {
            case '0':
              sort.changeMessage = getSort(orderData[i].dir);
              break;

            case '1':
              sort[`user.staffId`] = getSort(orderData[i].dir);
              break;

            case '2':
              sort[`user.name`] = getSort(orderData[i].dir);
              break;

            default:
              sort.createdAt = getSort(orderData[i].dir);
              break;
          }
        }
      }

      const filteredRecords = await ManageFormLog.aggregate([
        ...aggregateQuery,
        { $match: query },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]).allowDiskUse(true);
      const manageFormlog = await ManageFormLog.aggregate([
        ...aggregateQuery,
        { $match: query },
        {
          $project: {
            'user.name': 1,
            'user.staffId': 1,
            changeMessage: 1,
            changeType: 1,
            createdAt: 1,
            userName: 1,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]).allowDiskUse(true);

      manageFormlog.forEach((mform) => {
        if (mform.userName === 'DONOTCHANGE') {
          delete mform.user.name;
          delete mform.user.staffId;
        }
      });
      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalRecords.length ? totalRecords[0].count : 0,
        recordsFiltered: filteredRecords.length ? filteredRecords[0].count : 0,
        data: manageFormlog,
      };

      return res.status(200).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async updateManageFormData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const findCustomFormData = await ManageForm.findOne({
        _id: req.body._id,
      })
        .populate({
          path: 'customFormId',
          select: 'formStatus',
        })
        .lean();
      let newData = [];
      let oldData = [];
      let changeMessage = '';
      const fieldId = findCustomFormData.customFormId.formStatus.find(
        (v) => v._id.toString() === req.body.formStatus.fieldId,
      );
      const index = findCustomFormData.formStatus.findIndex(
        (v) => v.fieldId.toString() === req.body.formStatus.fieldId.toString(),
      );

      changeMessage += ` ${fieldId.fieldName} : `;
      if (index === -1) {
        findCustomFormData.formStatus.push({
          fieldId: req.body.formStatus.fieldId,
          fieldStatusValueId: req.body.formStatus.fieldStatusValueId,
        });
      } else {
        const valueId = fieldId.fieldStatus.find(
          (v) =>
            v._id.toString() ===
            findCustomFormData.formStatus[index].fieldStatusValueId.toString(),
        );

        oldData = [{ fieldId, valueId }];
        changeMessage += ` ${valueId.fieldStatusValue} -`;
        findCustomFormData.formStatus[index].fieldStatusValueId =
          req.body.formStatus.fieldStatusValueId;
      }

      const valueId = fieldId.fieldStatus.find(
        (v) => v._id.toString() === req.body.formStatus.fieldStatusValueId,
      );

      newData = [{ fieldId, valueId }];
      changeMessage += ` ${valueId.fieldStatusValue}`;
      const userId = req.user._id;
      const manageFormId = req.body._id;
      const changeType = 1;
      const { companyId } = req.user;

      await ManageFormLog({
        userId,
        manageFormId,
        changeType,
        oldData,
        newData,
        changeMessage,
        companyId,
      }).save();
      const customFormData = await ManageForm.findOneAndUpdate(
        {
          _id: req.body._id,
        },
        {
          $set: {
            formStatus: findCustomFormData.formStatus,
          },
        },
        {
          setDefaultsOnInsert: true,
        },
      ).lean();

      await challengeController.triggerChallenge(
        res,
        customFormData.userId,
        customFormData._id,
        'customform',
        null,
      );
      if (!customFormData) {
        return __.out(res, 300, {
          message: 'Updated Not Successfully',
        });
      }

      return __.out(res, 201, {
        message: 'Updated Successfully',
      });
    } catch (error) {
      return __.out(res, 300, error);
    }
  }

  async updateManageformWorkflowStatus(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        '_id',
        'workflowStatus',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 300, requiredResult.missingFields);
      }

      const findCustomFormData = await ManageForm.findOne({
        _id: req.body._id,
      })
        .populate({
          path: 'customFormId',
          select: 'workflow',
        })
        .lean();
      let errorMsg;

      if (
        !findCustomFormData.customFormId.workflow ||
        !findCustomFormData.customFormId.workflow.length
      )
        errorMsg = 'No workfow in forms';

      let newData = [];
      let oldData = [];
      let changeMessage = '';
      const fieldId = findCustomFormData.customFormId.workflow.find(
        (v) => v._id.toString() === req.body.workflowStatus.fieldId,
      );

      if (
        !fieldId.admin.find((adm) => adm.toString() === req.user._id.toString())
      )
        errorMsg = 'You are not admin for this workflow';

      if (errorMsg)
        return __.out(res, 300, {
          message: errorMsg,
        });

      const index = findCustomFormData.workflowStatus.findIndex(
        (v) =>
          v.fieldId.toString() === req.body.workflowStatus.fieldId.toString(),
      );

      changeMessage += ` ${fieldId.title} : `;
      if (
        index === -1 ||
        !findCustomFormData.workflowStatus[index].fieldStatusId
      ) {
        if (index === -1) {
          findCustomFormData.workflowStatus.push({
            fieldId: req.body.workflowStatus.fieldId,
            fieldStatusId: req.body.workflowStatus.fieldStatusId,
          });
        } else {
          findCustomFormData.workflowStatus[index].fieldStatusId =
            req.body.workflowStatus.fieldStatusId;
        }
      } else {
        const valueId = fieldId.workflowStatus.find(
          (v) =>
            v._id.toString() ===
            findCustomFormData.workflowStatus[index].fieldStatusId.toString(),
        );

        oldData = [{ fieldId, valueId }];
        changeMessage += `${valueId.field} -`;
        findCustomFormData.workflowStatus[index].fieldStatusId =
          req.body.workflowStatus.fieldStatusId;
      }

      const valueId = fieldId.workflowStatus.find(
        (v) => v._id.toString() === req.body.workflowStatus.fieldStatusId,
      );

      newData = [{ fieldId, valueId }];
      changeMessage += ` ${valueId.field}`;
      const userId = req.user._id;
      const userName = req.user.name;
      const { staffId } = req.user;
      const manageFormId = req.body._id;
      const changeType = 1;
      const { companyId } = req.user;
      const logs = [
        {
          userId,
          manageFormId,
          changeType,
          oldData,
          newData,
          changeMessage,
          userName,
          staffId,
          companyId,
        },
      ];
      // await ManageFormLog({ userId, manageFormId, changeType, oldData, newData, changeMessage, userName, staffId, companyId }).save();
      // check for type 3 workflow conditions and update starts
      const updateStatus = () => {
        const workflowWithType =
          findCustomFormData.customFormId.workflow.filter(
            (flow) =>
              flow.type === 3 &&
              !findCustomFormData.workflowStatus.find(
                (ws) =>
                  ws.fieldId.toString() === flow._id.toString() &&
                  !!ws.fieldStatusId,
              ),
          );

        workflowWithType.forEach((flow) => {
          let wStatus;
          const defineWorkflowStatus = () => {
            const statusAvail = flow.workflowStatus.find(
              (status) => status.isDefault,
            );

            wStatus = { fieldId: flow._id };
            if (statusAvail) wStatus.fieldStatusId = statusAvail._id;
          };

          if (flow.type === 3) {
            // 3.Conditional based on workflow response
            const wValidation = (workflow) =>
              !!findCustomFormData.workflowStatus.find(
                (wflow) =>
                  wflow.fieldId.toString() === workflow.workflowId.toString() &&
                  (wflow.fieldStatusId
                    ? wflow.fieldStatusId.toString() ===
                      workflow.statusId.toString()
                    : false),
              );

            if (flow.workflowResponse.some(wValidation)) defineWorkflowStatus();
          }

          if (
            !!wStatus &&
            !findCustomFormData.workflowStatus.find(
              (wf) => wf.fieldId.toString() === wStatus.fieldId.toString(),
            )
          ) {
            findCustomFormData.workflowStatus.push(wStatus);
            if (wStatus.fieldStatusId) {
              logs.push({
                manageFormId,
                userId,
                userName: 'DONOTCHANGE',
                changeType,
                oldData: [],
                newData: [
                  {
                    fieldId: flow,
                    valueId: flow.workflowStatus.find(
                      (status) => status.isDefault,
                    ),
                  },
                ],
                changeMessage: `${flow.title} : ${
                  flow.workflowStatus.find((status) => status.isDefault).field
                }`,
                companyId,
              });
            }
          }
        });
      };
      let currentWorkflowLength = 0;
      const callback = () => {
        currentWorkflowLength = findCustomFormData.workflowStatus.length;
        updateStatus();
        if (currentWorkflowLength < findCustomFormData.workflowStatus.length) {
          callback();
        }
      };

      callback();
      // check for type 3 workflow conditions and update ends
      const customFormData = await ManageForm.findOneAndUpdate(
        {
          _id: req.body._id,
        },
        {
          $set: {
            workflowStatus: findCustomFormData.workflowStatus,
          },
        },
        {
          setDefaultsOnInsert: true,
        },
      ).lean();

      logs.forEach((logg) => ManageFormLog(logg).save());
      await challengeController.triggerChallenge(
        res,
        customFormData.userId,
        customFormData._id,
        'customform',
        null,
      );
      if (!customFormData) {
        return __.out(res, 300, {
          message: 'Updated Not Successfully',
        });
      }

      return __.out(res, 201, {
        message: 'Updated Successfully',
      });
    } catch (error) {
      return __.out(res, 300, 'something went wrong');
    }
  }

  async getManageData(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const manageFormData = await ManageForm.find({
        customFormId: req.body.customFormId,
      })
        .populate({
          path: 'customFormId',
          select: 'formStatus viewOnly',
        })
        .populate({
          path: 'userId',
          select: 'name',
        })
        .lean();

      return __.out(res, 201, {
        data: manageFormData,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  // getManage Questions Response
  async getManageQuestions(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const getQuestionResponse = await ManageForm.findOne({
        _id: req.body._id,
      })
        .populate({
          path: 'questionId',
          // populate: {
          //      path: 'questionId'
          // }
        })
        .populate({
          path: 'customFormId',
        })
        .populate({
          path: 'questions',
        })
        .lean();

      __.log(getQuestionResponse);
      if (req.body.m === 1) {
        return res.status(201).json(getQuestionResponse);
      }

      return __.out(res, 201, {
        data: getQuestionResponse,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  // get Admin Manage Questions Response form Mobile

  async getManageFormAnswers(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const {
        isAdminModule,
        moduleId,
        customFormId,
        manageFormId,
        workflowId,
      } = req.body;

      const requiredResult = await __.checkRequiredFields(
        req,
        isAdminModule
          ? ['moduleId', 'customFormId', 'manageFormId', 'workflowId']
          : ['manageFormId', 'customFormId'],
      );

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      let getManageFormDetails;

      if (isAdminModule) {
        getManageFormDetails = await ManageAdminForm.find({
          moduleId,
          customFormId,
          manageFormId,
          workflowId,
        })
          .populate([
            {
              path: 'questionId',
              populate: {
                path: 'questionId',
              },
            },
          ])
          .lean();
        if (
          !getManageFormDetails ||
          !Object.keys(getManageFormDetails).length
        ) {
          getManageFormDetails = { notAnswered: true };
          return __.out(res, 201, {
            data: getManageFormDetails,
          });
        }
      } else {
        getManageFormDetails = await ManageForm.find({
          _id: manageFormId,
          customFormId,
        })
          .populate([
            {
              path: 'questionId',
              populate: {
                path: 'questionId',
              },
            },
          ])
          .lean();
      }

      let index = 0;

      const promiseData1 = [];
      const getManageFormListCall = async (qns) => {
        let i = 0;

        const promiseData = [];
        const questionIdListCall = async (re) => {
          if (!!re.questionId && re.questionId.type === 4) {
            const questionId = re.questionId._id;
            const { options, total } =
              await questionModule.getPollingResultArray({
                customFormId,
                questionId,
              });
            const obj = {
              total,
              percentData: {},
            };

            options.forEach((element) => {
              obj.percentData[element._id] = element.percentage.toFixed(1);
            });
            qns.questionId[i].answer = obj;
          }

          i += 1;
        };

        for (const re of qns.questionId) {
          promiseData.push(questionIdListCall(re));
        }

        await Promise.all(promiseData);

        const getImageSrc = (strings) => {
          const imagearray = [];
          const stringsplit = strings.split('<');
          const imgfiltered = stringsplit.filter((v) => v.startsWith('img '));

          imgfiltered.forEach((item) => {
            const newimgpos = item.split('src="')[1];

            imagearray.push(newimgpos.substring(0, newimgpos.indexOf('"')));
          });
          return imagearray;
        };

        const getVideoSrc = (strings) => {
          const videoarray = [];
          const stringsplit = strings.split('<');
          const videofiltered = stringsplit.filter(
            (v) => v.startsWith('video ') || v.startsWith('iframe '),
          );

          videofiltered.forEach((item) => {
            const newvideopos = item.split('src="')[1];

            videoarray.push(newvideopos.substring(0, newvideopos.indexOf('"')));
          });
          return videoarray;
        };

        qns.questionId = qns.questionId.reduce((prev, question) => {
          if (question.questionId) {
            question.questionId.images = question.questionId.images || [];
            question.questionId.videos = question.questionId.videos || [];
            question.questionId.images = getImageSrc(
              question.questionId.question,
            );
            question.questionId.question = question.questionId.question.replace(
              /<img .*?>/g,
              '',
            );
            question.questionId.videos = getVideoSrc(
              question.questionId.question,
            );
            question.questionId.question = question.questionId.question.replace(
              /<video.*>.*?<\/video>/gi,
              '',
            );
            return prev.concat(question);
          }

          return prev;
        }, []);

        getManageFormDetails[index] = qns;
        index += 1;
      };

      for (const qns of getManageFormDetails) {
        promiseData1.push(getManageFormListCall(qns));
      }

      await Promise.all(promiseData1);

      if (!getManageFormDetails) {
        return __.out(res, 300, {
          message: 'Not found manageform users details',
        });
      }

      return __.out(res, 201, {
        data: getManageFormDetails,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async getManageFormUsers(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const formStatus = await CustomForm.findById(req.body.customFormId)
        .select('formStatus workflow')
        .lean();
      const getManageFormUserDetails = await ManageForm.find({
        userId: req.user._id,
        customFormId: req.body.customFormId,
      })
        .populate([
          {
            path: 'questionId',
            populate: {
              path: 'questionId',
            },
          },
        ])
        .lean();
      // __.log(JSON.stringify(formStatus), 'formStatus');
      let index = 0;

      const promiseData1 = [];
      const getManageFormUserDetailsCall = async (qns) => {
        let i = 0;

        const promiseData = [];
        const questionIdListCall = async (re) => {
          if (!!re.questionId && re.questionId.type === 4) {
            const { customFormId } = req.body;
            const questionId = re.questionId._id;
            const selectedPollingAns =
              await questionModule.getPollingResultArray({
                customFormId,
                questionId,
              });
            const { options, total } =
              await questionModule.getPollingResultArray({
                customFormId,
                questionId,
              });
            const obj = {
              total,
              percentData: {},
            };

            options.forEach((element) => {
              obj.percentData[element._id] = element.percentage.toFixed(1);
            });
            qns.questionId[i].answer = obj;
            qns.questionId[i].selAnswer = selectedPollingAns.options;
          }

          i += 1;
        };

        for (const re of qns.questionId) {
          promiseData.push(questionIdListCall(re));
        }

        await Promise.all(promiseData);

        const getImageSrc = (strings) => {
          const imagearray = [];
          const stringsplit = strings.split('<');
          const imgfiltered = stringsplit.filter((v) => v.startsWith('img '));

          imgfiltered.forEach((item) => {
            const newimgpos = item.split('src="')[1];

            imagearray.push(newimgpos.substring(0, newimgpos.indexOf('"')));
          });
          return imagearray;
        };

        const getVideoSrc = (strings) => {
          const videoarray = [];
          const stringsplit = strings.split('<');
          const videofiltered = stringsplit.filter(
            (v) => v.startsWith('video ') || v.startsWith('iframe '),
          );

          videofiltered.forEach((item) => {
            const newvideopos = item.split('src="')[1];

            videoarray.push(newvideopos.substring(0, newvideopos.indexOf('"')));
          });
          return videoarray;
        };

        qns.questionId = qns.questionId.reduce((prev, question) => {
          if (question.questionId) {
            question.questionId.images = question.questionId.images || [];
            question.questionId.videos = question.questionId.videos || [];
            question.questionId.images = getImageSrc(
              question.questionId.explanation,
            );
            question.questionId.question = question.questionId.question.replace(
              /<img .*?>/g,
              '',
            );
            question.questionId.videos = getVideoSrc(
              question.questionId.explanation,
            );
            question.questionId.question = question.questionId.question.replace(
              /<video.*>.*?<\/video>/gi,
              '',
            );
            return prev.concat(question);
          }

          return prev;
        }, []);

        const manageFormStatus = qns.formStatus;

        formStatus.formStatus.forEach((v, c) => {
          const { fieldName } = v;
          const statusFlag = v.fieldStatus.find((fs1) =>
            manageFormStatus.some(
              (mfs) => fs1._id.toString() === mfs.fieldStatusValueId.toString(),
            ),
          );
          const status = statusFlag ? statusFlag.fieldStatusValue : '---';

          qns.showFormStatus = qns.showFormStatus || [];
          qns.showFormStatus[c] = { fieldName, status };
        });
        if (formStatus.workflow) {
          const manageFormWorkflowStatus = qns.workflowStatus;

          formStatus.workflow.forEach((v, c) => {
            const { title } = v;
            const statusFlag = v.workflowStatus.find((fs1) =>
              manageFormWorkflowStatus.some(
                (mfs) =>
                  mfs.fieldStatusId &&
                  fs1._id.toString() === mfs.fieldStatusId.toString(),
              ),
            );
            const status = statusFlag ? statusFlag.field : '---';

            qns.showFormWorkflowStatus = qns.showFormWorkflowStatus || [];
            qns.showFormWorkflowStatus[c] = { fieldName: title, status };
          });
        }

        getManageFormUserDetails[index] = qns;
        index += 1;
      };

      for (const qns of getManageFormUserDetails) {
        promiseData1.push(getManageFormUserDetailsCall(qns));
      }

      await Promise.all(promiseData1);

      if (!getManageFormUserDetails) {
        return __.out(res, 300, {
          message: 'Not found manageform users details',
        });
      }

      return __.out(res, 201, {
        data: getManageFormUserDetails,
      });
    } catch (error) {
      return __.out(res, 500, error);
    }
  }

  async printCustomFormAsPDF(req, res) {
    try {
      const _this = this;

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const managedForm = await ManageForm.findById(req.body._id).populate([
        {
          path: 'customFormId',
          select: 'moduleId',
          populate: {
            path: 'moduleId',
          },
        },
        {
          path: 'questionId',
          select: 'questionId answer',
          populate: {
            path: 'questionId',
          },
        },
      ]);
      const formatTime = (time) => {
        if (`${time}`.includes('-')) {
          return time;
        }

        return moment(time, 'HH:mm:ss').format('hh-mm-A');
      };
      const questions = managedForm.questionId.map((question) => {
        let answer = ``;

        switch (question.questionId.type) {
          case 1:
            break;

          case 8:
            break;

          case 9:
            break;

          case 13:
            answer = question.answer;
            break;

          case 2:
            break;

          case 3:
            break;

          case 4:
            answer = question.answer.value;
            break;

          case 11:
            answer = _this.isObject(question.answer)
              ? question.answer.value
              : question.answer;
            break;

          case 5:
            break;

          case 15:
            answer = question.answer.map((a) => a.value).join(', ');
            break;

          case 10:
            answer = `${question.answer.date || ''} ${
              formatTime(question.answer.time) || ''
            }`;
            break;

          case 12:
            answer = question.answer.name;
            break;

          case 14:
            answer = question.answer.reduce(
              (prev, curr) => `${prev}, ${curr.text ? curr.text : curr.name}`,
              '',
            );

            break;

          case 6:
            question.answer = `${question.answer || ''}`.startsWith(
              `data:image/png;base64,`,
            )
              ? question.answer
              : `data:image/png;base64,${question.answer}`;
            answer = `<img src="${question.answer}" width="100" height="auto" />`;
            break;

          default:
            break;
        }
        return { question: question.questionId.question, answer };
      });

      const { closingMessage, welComeAttachement, welComeMessage } =
        managedForm.customFormId.moduleId;
      const url = `${req.protocol}://${req.get('host')}`;
      const flag = await __.writePdfToCustomForm({
        closingMessage,
        welComeAttachement,
        welComeMessage,
        questions,
        manageForm: managedForm._id,
        url,
      });

      if (flag) {
        return __.out(res, 201, {
          csvLink: `./uploads/customFormExport/${managedForm._id}.pdf`,
        });
      }

      return __.out(res, 300, 'Something went wrong try later');
    } catch (error) {
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async exportWallPost(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const managedForm = await ManageForm.findOne({ _id: req.body._id })
        .populate({
          path: 'customFormId',
          select: 'moduleId isDeployed title formStatus workflow',
          populate: {
            path: 'moduleId',
            select:
              'questions closingMessage welComeAttachement welComeMessage',
            populate: {
              path: 'questions',
            },
          },
        })
        .populate({
          path: 'questionId',
          select: 'questionId answer',
          populate: {
            path: 'questionId',
          },
        })
        .lean();
      const _this = this;
      const formatTime = (time) => {
        if (`${time}`.includes('-')) {
          return time;
        }

        return moment(time, 'HH:mm:ss').format('hh-mm-A');
      };
      const setQuestions = (model) =>
        model.questionId.reduce((prev, v) => {
          const { question } = v.questionId;
          let answer = null;

          switch (v.questionId.type) {
            case 1:
              break;

            case 8:
              break;

            case 9:
              break;

            case 13:
              answer = v.answer;
              break;

            case 2:
              break;

            case 3:
              break;

            case 4:
              answer = v.answer.value;
              break;

            case 11:
              answer = _this.isObject(v.answer) ? v.answer.value : v.answer;
              break;

            case 5:
              break;

            case 15:
              v.answer = Array.isArray(v.answer) ? v.answer : [v.answer];
              answer = v.answer.map((a) => a.value).join(', ');
              break;

            case 10:
              answer = `${v.answer.date || ''} ${
                v.answer.time ? formatTime(v.answer.time) : ''
              }`;
              break;

            case 12:
              answer = v.answer.fileName;
              break;

            case 14:
              answer = v.answer
                .map((c) => (c.text ? c.text : c.name))
                .join(', ');
              break;

            case 6:
              v.answer = `${v.answer || ''}`.startsWith(
                `data:image/png;base64,`,
              )
                ? v.answer
                : `data:image/png;base64,${v.answer}`;
              answer = v.answer;
              break;

            case 16:
              {
                const mq = model.moduleId || model.customFormId.moduleId;
                const qFind = mq.questions.find(
                  (q) => q._id.toString() === v.questionId._id.toString(),
                );
                const isTouching = ({ x, y, radious }, i) => {
                  const spot = qFind.options.map(
                    (answer1) => answer1.coordinates,
                  )[i];
                  const { x1, y1, r1 } = { x1: +x, y1: +y, r1: +radious };
                  const { x2, y2 } = {
                    x2: +spot.x,
                    y2: +spot.y,
                    r2: +spot.radious,
                  };
                  const c1 = Math.sqrt(
                    (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1),
                  );

                  // $scope.color = c1 > r1*2 ? 'red' : 'green';
                  return c1 <= r1 * 2;
                };
                const isAllCirclesAvailable =
                  v.answer.length === qFind.options.length;
                const bool = v.answer.reduce(
                  (answerFlag, answers, i) =>
                    answerFlag && isTouching(answers.coordinates, i),
                  isAllCirclesAvailable,
                );

                answer = `PP-${bool ? 'correct' : 'incorrect'}`;
              }
              break;

            default:
              break;
          }
          return answer ? prev.concat({ question, answer }) : prev;
        }, []);
      const workflowModuleIds = managedForm.customFormId.workflow
        ? managedForm.customFormId.workflow
            .filter((w) => w.additionalModuleId)
            .map((w) => w.additionalModuleId)
        : [];
      let manageAdminForm;

      if (workflowModuleIds.length) {
        manageAdminForm = await ManageAdminForm.find({
          manageFormId: req.body._id,
          moduleId: {
            $in: workflowModuleIds,
          },
        })
          .populate({
            path: 'moduleId',
            select:
              'questions closingMessage welComeAttachement welComeMessage',
            populate: {
              path: 'questions',
            },
          })
          .populate({
            path: 'questionId',
            select: 'questionId answer',
            populate: {
              path: 'questionId',
            },
          })
          .lean();
      }

      let questions = [...setQuestions(managedForm)];

      workflowModuleIds.forEach(async (mid) => {
        const maf = manageAdminForm.find(
          (m) => m.moduleId._id.toString() === mid.toString(),
        );

        questions.push({
          question: `<u>${
            managedForm.customFormId.workflow.find(
              (w) => w.additionalModuleId === mid,
            ).title
          } - workflow questions</u>`,
        });
        if (maf) {
          questions.push(...setQuestions(maf));
        } else {
          const bmq = await BuilderModule.findOne({
            _id: mid,
          })
            .populate({
              path: 'questions',
            })
            .lean();

          bmq.questions.forEach((q) => {
            questions.push({
              question: q.question,
              answer: '--',
            });
          });
        }
      });

      const profile = managedForm.customFormId.moduleId.questions.filter(
        (question) => question.type === 7,
      );
      const internalQuestions = profile[0] ? profile[0].profile : [];
      const internal = internalQuestions.map((iq) =>
        iq.questionName.toLowerCase(),
      );

      if (managedForm.userId) {
        const user = await User.findById(managedForm.userId)
          .select(
            `name staffId parentBussinessUnitId appointmentId subSkillSets email contactNumber`,
          )
          .populate([
            {
              path: 'subSkillSets',
              select: 'name status',
              match: {
                status: 1,
              },
              populate: {
                path: 'skillSetId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
            },
            {
              path: 'appointmentId',
              select: 'name status',
              match: {
                status: 1,
              },
            },
            {
              path: 'parentBussinessUnitId',
              select: 'name',
              populate: {
                path: 'sectionId',
                select: 'name',
                populate: {
                  path: 'departmentId',
                  select: 'name',
                  populate: {
                    path: 'companyId',
                    select: 'name',
                  },
                },
              },
            },
          ])
          .lean();

        const elem = user.parentBussinessUnitId;
        const moreData = [
          { question: 'staffId', answer: user.staffId },
          { question: 'username', answer: user.name },
          {
            question: 'business Unit',
            answer: `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`,
          },
        ];

        if (profile.length) {
          if (internalQuestions.length) {
            internal.forEach((curr) => {
              switch (curr) {
                // case 'username':
                //     moreData.push({ question: 'username', answer: user.name });
                //     break;
                case 'appointment':
                  moreData.push({
                    question: 'appointment',
                    answer: user.appointmentId.name,
                  });
                  break;

                case 'mobile':
                  moreData.push({
                    question: 'mobile',
                    answer: user.contactNumber,
                  });
                  break;

                case 'email':
                  moreData.push({ question: 'email', answer: user.email });
                  break;

                default:
                  break;
              }
            });
          }
        }

        moreData.push({
          question: 'Submitted on',
          answer: moment(managedForm.createdAt)
            .add(-req.body.timeZone, 'minutes')
            .format('lll'),
        });
        questions = [...moreData, ...questions];
      } else {
        questions = [
          ...[
            {
              question: 'Submitted on',
              answer: moment(managedForm.createdAt)
                .add(-req.body.timeZone, 'minutes')
                .format('lll'),
            },
          ],
          ...questions,
        ];
        const pro = managedForm.questionId.filter(
          (v) => v.questionId.type === 7,
        );

        if (
          managedForm.customFormId.isDeployed === 2 &&
          pro.length &&
          !!pro[0].answer
        ) {
          const moreData = [];

          for (const key of Object.keys(pro[0].answer)) {
            if (Object.prototype.hasOwnProperty.call(pro[0].answer, key)) {
              const element = pro[0].answer[key];

              moreData.push({ question: key, answer: element });
            }
          }
          questions = [...moreData, ...questions];
        }
      }

      questions.push({
        question: '<u>Status</u>',
      });

      managedForm.customFormId.formStatus.forEach((fs1) => {
        const currentFormStatus =
          !!managedForm.formStatus.length &&
          managedForm.formStatus.find((s) => s.fieldId === fs1._id.toString());

        let answer = '--';

        if (currentFormStatus) {
          const matchingFieldStatus = fs1.fieldStatus.find(
            (ff) => ff._id.toString() === currentFormStatus.fieldStatusValueId,
          );

          if (matchingFieldStatus) {
            answer = matchingFieldStatus.fieldStatusValue;
          }
        }

        questions.push({
          question: fs1.fieldName,
          answer,
        });
      });

      if (managedForm.customFormId.workflow) {
        managedForm.customFormId.workflow.forEach((ws) => {
          const currentFormStatus =
            !!managedForm.workflowStatus.length &&
            managedForm.workflowStatus.find(
              (s) => s.fieldId === ws._id.toString(),
            );

          let answer = '--';

          if (currentFormStatus) {
            const matchingWorkflowStatus = ws.workflowStatus.find(
              (ff) => ff._id.toString() === currentFormStatus.fieldStatusId,
            );

            if (matchingWorkflowStatus) {
              answer = matchingWorkflowStatus.field;
            }
          }

          questions.push({
            question: ws.title,
            answer,
          });
        });
      }

      const url = `${req.protocol}://${req.get('host')}`;
      const { closingMessage, welComeAttachement, welComeMessage } =
        managedForm.customFormId.moduleId;
      const formId = managedForm.formId || false;
      const flag = await __.writePdfToCustomForm({
        closingMessage,
        welComeAttachement,
        attachementAvailable: !!welComeAttachement,
        welComeMessage,
        questions,
        manageForm: managedForm._id,
        formId,
        title: managedForm.customFormId.title,
        url,
      });

      if (flag) {
        return __.out(res, 201, {
          csvLink: `./uploads/customFormExport/${managedForm._id}.pdf`,
        });
      }

      return __.out(res, 200, 'Something went wrong try later');
    } catch (err) {
      __.log(err);
      return __.out(res, 200, 'Something went wrong try later');
    }
  }

  async exportFormCsv(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { fromDate, toDate, formStatus, workflow, customFormId } = req.body;

      if (!customFormId) {
        return __.out(res, 300, `Invalid customform`);
      }

      const query = {
        // customFormId : customFormId
      };

      if (fromDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = moment(fromDate).utc().startOf('day').format();
      }

      if (toDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = moment(toDate).utc().endOf('day').format();
      }

      const customForm = await CustomForm.findById(customFormId)
        .select('title')
        .lean();
      let manageformLogs;

      if (!!formStatus && formStatus.length) {
        query['newData.valueId._id'] = {
          $in:
            formStatus.map((status) =>
              mongoose.Types.ObjectId(status.fieldStatusValueId),
            ) || [],
        };
        manageformLogs = await ManageFormLog.find(query)
          .populate([
            {
              path: 'userId',
              select: 'name',
            },
          ])
          .select('manageFormId createdAt userId changeMessage')
          .lean();
      } else if (!!workflow && workflow.length) {
        query['newData.valueId._id'] = {
          $in:
            workflow.map((status) =>
              mongoose.Types.ObjectId(status.workflowStatusId),
            ) || [],
        };
        manageformLogs = await ManageFormLog.find(query)
          .populate([
            {
              path: 'userId',
              select: 'name',
            },
          ])
          .select('manageFormId createdAt userId changeMessage')
          .lean();
      } else {
        const query1 = [
          { $match: { _id: mongoose.Types.ObjectId(customFormId) } },
          { $project: { formStatus: 1 } },
          {
            $lookup: {
              from: 'manageforms',
              localField: '_id',
              foreignField: 'customFormId',
              as: 'manageform',
            },
          },
          { $unwind: '$manageform' },
          {
            $lookup: {
              from: 'manageformlogs',
              localField: 'manageform._id',
              foreignField: 'manageFormId',
              as: 'log',
            },
          },
          { $match: { log: { $gt: { $size: 0 } } } },
          { $unwind: '$log' },
        ];
        const query2 = [
          {
            $lookup: {
              from: 'users',
              localField: 'log.userId',
              foreignField: '_id',
              as: 'userId',
            },
          },
          { $unwind: '$userId' },
          {
            $project: {
              changeMessage: '$log.changeMessage',
              createdAt: '$log.createdAt',
              userId: { name: '$userId.name' },
              _id: 0,
              formId: '$manageform.formId',
            },
          },
        ];

        if (!!fromDate || !!toDate) {
          const query4 = { $match: { $and: [] } };

          if (fromDate)
            query4.$match.$and.push({
              'log.createdAt': {
                $gte: moment(fromDate).utc().startOf('day').toDate(),
              },
            });

          if (toDate)
            query4.$match.$and.push({
              'log.createdAt': {
                $lte: moment(toDate).utc().endOf('day').toDate(),
              },
            });

          query1.push(query4);
        }

        manageformLogs = await CustomForm.aggregate([...query1, ...query2]);
      }

      if (!customForm) {
        return __.out(res, 300, `Customform not found`);
      }

      const responseBody = [];

      manageformLogs.forEach((log, i) => {
        const obj = {};

        obj.SNo = i + 1;
        obj['Form name'] = customForm.title;
        obj['Form Id'] = log.formId ? log.formId : '--';
        obj['Updated At'] = log.createdAt
          ? moment(log.createdAt)
              .add(-req.query.timeZone, 'minutes')
              .format('lll')
          : '--';
        obj['Updated By'] = log.userId ? log.userId.name : '--';
        obj.Status = log.changeMessage;
        responseBody.push(obj);
      });
      const headers = Array.from(
        new Set([
          'SNo',
          'Form name',
          'Form Id',
          'Updated At',
          'Updated By',
          'Status',
        ]),
      );

      if (responseBody.length === 0) {
        return __.out(res, 200, 'There is no workflow data in this form');
      }

      const csv = json2csv(responseBody, headers);
      let returnData;

      fs.writeFile(
        `./public/uploads/customForm/${customFormId}.csv`,
        csv,
        (err) => {
          if (err) {
            returnData = __.out(res, 300, 'Something went wrong try later');
          }

          returnData = __.out(res, 201, {
            csvLink: `/uploads/customForm/${customFormId}.csv`,
          });
        },
      );
      return returnData;
    } catch (error) {
      return __.out(res, 300, `Something went wrong try later`);
    }
  }

  async getCustomFormStatus(req, res) {
    try {
      const customFormData = CustomForm.findOne({
        _id: '5cecf3517ea0f2308c5d02b7',
      }).lean();

      await ManageForm.aggregate([
        {
          $match: {
            customFormId: mongoose.Types.ObjectId('5cecf3517ea0f2308c5d02b7'),
            formStatus: {
              $ne: [],
            },
          },
        },
        {
          $unwind: {
            path: '$formStatus',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: '$formStatus.fieldId',
            data: {
              $push: {
                fieldStatusValueId: '$formStatus.fieldStatusValueId',
                fieldId: '$formStatus._id',
              },
            },
          },
        },
        {
          $unwind: {
            path: '$data',
          },
        },
      ]);
      const formStatus = await ManageForm.find({
        customFormId: '5cecf3517ea0f2308c5d02b7',
      }).lean();

      // formStatus.reduce((prev, curr, i)=>{},[])
      return __.out(res, 201, { data: { formStatus, customFormData } });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  // external forms baseURL for mobile
  async getExternalFormsBaseUrl(req, res) {
    try {
      // staging = 'https://admin.polarisdev2.gq/'
      // production = 'https://admin.net-roc.com/'
      // client staging account 'https://admin.net-roc.gq/'
      // Doodleblue staging account 'https://admin.netroc-stage.gq/'
      // New Doodleblue staging account = 'https://admin.stage-netroc.gq/'
      // New Client Staging = 'https://admin.dbstage.gq/'

      // Don't Remove This Commented Code Keeping it for Future Feference

      // const baseUrls = {
      //   'https://admin.net-roc.com': 'https://www.net-roc.com/',
      //   'https://admin.net-roc.gq': 'https://net-roc.gq/',
      //   'https://admin.netroc-stage.gq': 'https://netroc-stage.gq/',
      //   'https://admin.stage-netroc.gq': 'https://stage-netroc.gq/',
      //   'https://admin.net-roc2.win': 'https://net-roc2.win/',
      //   'https://admin.dbstage.gq': 'https://dbstage.gq/',
      //   'https://admin.netroc3.tk': 'https://netroc3.tk/',
      //   'https://admin.netroc6.win': 'https://netroc6.win/',
      //   'https://admin.netroc4.win': 'https://netroc4.win/'
      // };
      const backendBaseURL = `https://${req.get('host')}`;
      let baseUrl = null;

      if (backendBaseURL === process.env.LIVE_SERVER_BASEURL) {
        baseUrl = process.env.LIVE_CLIENT_BASEURL;
      }

      // const baseUrl = baseUrls[backendBaseURL];
      return __.out(res, 201, { isbaseUrlExists: !!baseUrl, baseUrl });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async getFormSettings(req, res, getOnly) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      let fieldStatus = await FormSetting.findOne({
        createdBy: req.user._id,
        formId: req.params.customFormId,
      }) /* .select('fieldStatus') */
        .lean();

      if (fieldStatus) {
        const { statusFilter } = fieldStatus;

        fieldStatus = fieldStatus.fieldStatus;
        /* if(!!fieldStatus || !!statusFilter){
                    return __.out(res, 201, { fieldStatus, statusFilter });
                } */
        if (getOnly) return { fieldStatus, statusFilter };

        return __.out(res, 201, { fieldStatus, statusFilter });
      }

      return __.out(res, 201, { fieldStatus: [], statusFilter: [] });
    } catch (error) {
      __.log(error);
      if (getOnly) return {};

      return __.out(res, 300, { error });
    }
  }

  async setFormSettings(req, res, updateOnly) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { customFormId, fieldStatus, statusFilter } = req.body;
      const form = await CustomForm.findById(customFormId).select('_id').lean();

      if (!!form && !!fieldStatus) {
        await FormSetting.update(
          { createdBy: req.user._id, formId: form._id },
          {
            $set: {
              fieldStatus,
              createdBy: req.user._id,
              formId: form._id,
            },
          },
          { upsert: true },
        );
      }

      if (!!form && !!statusFilter) {
        await FormSetting.update(
          { createdBy: req.user._id, formId: form._id },
          { $set: { statusFilter, createdBy: req.user._id, formId: form._id } },
          { upsert: true },
        );
      }

      if (updateOnly && (!!fieldStatus || !!statusFilter)) return true;

      return __.out(res, 201, 'Setting successfully updated');
    } catch (error) {
      __.log(error);
      return __.out(res, 300, { error });
    }
  }

  async getCustomFormsforAdmin(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const page = req.body.page ? parseInt(req.body.page, 10) * 10 : 0;
      const query = {
        'assignUsers.admin': {
          $in: [req.user._id],
        },
        status: 1,
      };

      if (req.body.q) {
        query.title = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }

      const customForms = await CustomForm.find(query)
        .select('title')
        .skip(page)
        .limit(10)
        .lean();
      const countFiltered = await CustomForm.find(query).count();

      if (!customForms) {
        return __.out(res, 300, 'No users Found');
      }

      return __.out(res, 201, { items: customForms, countFiltered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async createFormPushNotification(customForm, timeZone, res) {
    try {
      const sendNotification = async (customFormm, users) => {
        const collapseKey = customFormm._id;
        const usersWithToken = await User.find({
          _id: {
            $in: users || [],
          },
        })
          .select('deviceToken')
          .lean();
        const pushData = {
          title: customFormm.title,
          body: `${customFormm.title} is available for submission Now@${moment()
            .add(-timeZone, 'minutes')
            .format('lll')}`,
          redirect: 'myForms',
        };
        const deviceTokens = usersWithToken
          .map((user) => user.deviceToken)
          .filter(Boolean);

        if (deviceTokens.length) {
          await FCM.push(deviceTokens, pushData, collapseKey);
        }
      };
      let users = [];

      users = await __.userDetails({
        assignUsers: customForm.assignUsers,
        createdBy: customForm.createdBy,
      });
      if (users.length) {
        await sendNotification(customForm, users);
      }

      return users;
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'something went wrong');
    }
  }

  async exportManageforms(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { fromDate, toDate, parentBussinessUnitId, customFormId } =
        req.body;
      const { timeZone } = req.query;

      if (!customFormId) {
        return __.out(res, 300, `Invalid customform`);
      }

      let query = {
        customFormId: mongoose.Types.ObjectId(customFormId),
      };

      if (fromDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = moment(fromDate).utc().startOf('day').toDate();
      }

      if (toDate) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = moment(toDate).utc().endOf('day').toDate();
      }

      const customForm = await CustomForm.findById(customFormId)
        .populate([
          {
            path: 'moduleId',
            select: 'questions',
            populate: {
              path: 'questions',
            },
          },
        ])
        .select('formStatus moduleId title isDeployed workflow')
        .lean();
      let adminWorkflows;

      if (!!customForm.workflow && !!customForm.workflow.length) {
        adminWorkflows = customForm.workflow.filter((flow) =>
          flow.admin
            .map((admin) => admin.toString())
            .includes(req.user._id.toString()),
        );
      }

      if (adminWorkflows) {
        const workflowIds = adminWorkflows.map((flow) => flow._id.toString());

        query.workflowStatus = {
          $elemMatch: {
            fieldId: { $in: workflowIds },
          },
        };
      }

      if (!customForm) {
        return __.out(res, 300, `Customform not found`);
      }

      if (parentBussinessUnitId) {
        const manageformIds = await ManageForm.aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userId',
            },
          },
          { $unwind: '$userId' },
          {
            $match: {
              'userId.parentBussinessUnitId': mongoose.Types.ObjectId(
                parentBussinessUnitId,
              ),
            },
          },
          { $project: { _id: 1 } },
        ]);

        query = { _id: { $in: manageformIds.map((id) => id._id) } };
      }

      const managedFormResult = await ManageForm.find(query)
        .populate([
          {
            path: 'questionId',
            select: 'questionId answer',
          },
          {
            path: 'userId',
            select: `name staffId parentBussinessUnitId appointmentId subSkillSets email contactNumber`,
            populate: [
              {
                path: 'subSkillSets',
                select: 'name status',
                match: {
                  status: 1,
                },
                populate: {
                  path: 'skillSetId',
                  select: 'name status',
                  match: {
                    status: 1,
                  },
                },
              },
              {
                path: 'appointmentId',
                select: 'name status',
                match: {
                  status: 1,
                },
              },
              {
                path: 'parentBussinessUnitId',
                select: 'name',
                populate: {
                  path: 'sectionId',
                  select: 'name',
                  populate: {
                    path: 'departmentId',
                    select: 'name',
                    populate: {
                      path: 'companyId',
                      select: 'name',
                    },
                  },
                },
              },
            ],
          },
        ])
        .lean();
      let manageformLogs = await ManageFormLog.find({
        manageFormId: { $in: managedFormResult.map((id) => id._id) },
      })
        .sort({ _id: -1 })
        .select('manageFormId createdAt newData')
        .lean();

      manageformLogs = JSON.parse(JSON.stringify(manageformLogs));

      const questions = customForm.moduleId.questions || [];

      questions.sort((a, b) => a.indexNum - b.indexNum);
      const updateAppend = 'Updated At - ';
      const csStatus = customForm.formStatus
        .map((fs1) => fs1.fieldName)
        .reduce((sArr, status) => {
          if (!sArr) sArr = [];

          sArr.push(...[status, updateAppend + status]);
          return sArr;
        }, []);
      let questionTitles = questions.map((v, i) => `Q${i + 1}`);
      const responseBody = [];
      let count = 1;
      const _this = this;
      const formatTime = (time) => {
        if (`${time}`.includes('-')) {
          return time;
        }

        if (time) {
          return moment(time, 'HH:mm:ss').format('hh-mm-A');
        }

        return '';
      };

      for (const manageForm of managedFormResult) {
        const manageQuesitons = manageForm.questionId;
        const obj = {};

        questions.forEach((question, i) => {
          const index = manageQuesitons.findIndex(
            (v) => v.questionId.toString() === question._id.toString(),
          );
          let answer = null;

          if (index !== -1) {
            switch (question.type) {
              case 1:
                break;

              case 8:
                break;

              case 9:
                break;

              case 13:
                answer = manageQuesitons[index].answer || '--';
                break;

              case 2:
                break;

              case 3:
                break;

              case 4:
                answer = manageQuesitons[index].answer.value || '--';
                break;

              case 11:
                answer = _this.isObject(manageQuesitons[index].answer)
                  ? manageQuesitons[index].answer.value
                  : manageQuesitons[index].answer;
                break;

              case 5:
                break;

              case 15:
                answer =
                  manageQuesitons[index].answer
                    .map((a) => a.value)
                    .join(', ') || '--';
                break;

              case 10:
                answer = `${manageQuesitons[index].answer.date || ''} ${
                  formatTime(manageQuesitons[index].answer.time) || ''
                }`;
                break;

              case 12:
                answer = manageQuesitons[index].answer.name || '--';
                break;

              case 14:
                answer =
                  !!manageQuesitons[index] && manageQuesitons[index].length
                    ? manageQuesitons[index]
                        .map((v) => (v.text ? v.text : v.name))
                        .join(', ')
                    : '--';
                break;

              default:
                if (customForm.isDeployed === 2 && question.type === 7) {
                  if (manageQuesitons[index].answer) {
                    for (const key of Object.keys(
                      manageQuesitons[index].answer,
                    )) {
                      if (
                        Object.prototype.hasOwnProperty.call(
                          manageQuesitons[index].answer,
                          key,
                        )
                      ) {
                        const element = manageQuesitons[index].answer[key];

                        obj[key.toLowerCase()] = element;
                      }
                    }
                  }
                }

                answer = '--';
                break;
            }
          }

          obj[`Q${i + 1}`] = index === -1 ? '--' : answer;
        });
        const index = questions.findIndex((ques) => ques.type === 7);
        let internalQuestions = [];

        if (index !== -1) {
          internalQuestions = questions[index].profile;
        }

        const internal = internalQuestions.map((iq) =>
          iq.questionName.toLowerCase(),
        );

        if (customForm.isDeployed === 1) {
          if (manageForm.userId) {
            let userFields = ['staffId', 'StaffName', 'bussinessUnit'];

            obj.StaffName = manageForm.staffName;
            obj.staffId = manageForm.userId.staffId;
            const elem = manageForm.userId.parentBussinessUnitId;

            obj.bussinessUnit = `${elem.sectionId.departmentId.companyId.name}>${elem.sectionId.departmentId.name}>${elem.sectionId.name}>${elem.name}`;
            if (internalQuestions.length) {
              internal.forEach((curr) => {
                switch (curr) {
                  case 'username':
                    userFields = [...userFields, 'username'];
                    obj[curr] = manageForm.userId.name;
                    break;

                  case 'appointment':
                    userFields = [...userFields, 'appointment'];
                    obj.appointment = manageForm.userId.appointmentId.name;
                    break;

                  case 'mobile':
                    userFields = [...userFields, curr];
                    obj[curr] = manageForm.userId.contactNumber;
                    break;

                  case 'email':
                    userFields = [...userFields, curr];
                    obj[curr] = manageForm.userId.email;
                    break;

                  default:
                    break;
                }
              });
            }

            questionTitles = [...userFields, ...questionTitles];
          }
        } else {
          let userFields = [];

          internal.forEach((curr) => {
            switch (curr) {
              case 'username':
                userFields = [...userFields, 'username'];
                break;

              case 'appointment':
                userFields = [...userFields, 'appointment'];
                break;

              case 'mobile':
                userFields = [...userFields, curr];
                break;

              case 'email':
                userFields = [...userFields, curr];
                break;

              default:
                break;
            }
          });
          questionTitles = [...userFields, ...questionTitles];
        }

        customForm.formStatus.forEach((v) => {
          const index1 = manageForm.formStatus.findIndex(
            (mq) => mq.fieldId.toString() === v._id.toString(),
          );

          if (index1 === -1) {
            obj[v.fieldName] = '--';
            obj[updateAppend + v.fieldName] = '--';
          } else {
            const a = v.fieldStatus.find(
              (ele) =>
                ele._id.toString() ===
                manageForm.formStatus[index1].fieldStatusValueId,
            );

            obj[v.fieldName] = a.fieldStatusValue;
            const dateObj = manageformLogs.find(
              (log) =>
                log.manageFormId.toString() === manageForm._id.toString() &&
                log.newData[0].fieldId._id.toString() === v._id.toString(),
            );

            if (dateObj) {
              obj[updateAppend + v.fieldName] = moment(dateObj.createdAt)
                .add(-timeZone, 'minutes')
                .format('lll');
            } else {
              obj[updateAppend + v.fieldName] = '--';
            }
          }
        });
        const workflowTitles = adminWorkflows
          ? adminWorkflows
              .map((flow) => flow.title)
              .reduce((sArr, status) => {
                if (!sArr) sArr = [];

                sArr.push(...[status, updateAppend + status]);
                return sArr;
              }, [])
          : [];

        if (adminWorkflows) {
          adminWorkflows.forEach((workflow) => {
            const finder = manageForm.workflowStatus.find(
              (status) =>
                !!(status.fieldId.toString() === workflow._id.toString()) &&
                !!status.fieldStatusId,
            );

            if (finder) {
              obj[workflow.title] = workflow.workflowStatus.find(
                (status) =>
                  status._id.toString() === finder.fieldStatusId.toString(),
              ).field;
              const dateObj = manageformLogs.find(
                (log) =>
                  log.manageFormId.toString() === manageForm._id.toString() &&
                  log.newData[0].fieldId._id.toString() ===
                    workflow._id.toString(),
              );

              if (dateObj) {
                obj[updateAppend + workflow.title] = moment(dateObj.createdAt)
                  .add(-timeZone, 'minutes')
                  .format('lll');
              } else {
                obj[updateAppend + workflow.title] = '--';
              }
            } else {
              obj[workflow.title] = '--';
              obj[updateAppend + workflow.title] = '--';
            }
          });
        }

        obj.formname = customForm.title;
        obj['Submitted At'] = moment(manageForm.createdAt)
          .add(-timeZone, 'minutes')
          .format('lll');
        questionTitles = [
          'formname',
          'Submitted At',
          ...questionTitles,
          ...csStatus,
          ...workflowTitles,
        ];
        obj.SNo = count;
        count += 1;
        responseBody[responseBody.length] = obj;
      }
      // SNo	formname	Submitted At	staffId	StaffName	bussinessUnit	Q1	Q2	Q3	Q4	S	S2
      const headers = Array.from(new Set(['SNo', ...questionTitles]));

      if (!responseBody.length) {
        return __.out(res, 404, 'There is no data for the selected BU');
      }

      const csv = json2csv(responseBody, { fields: headers });
      let returnMsg;

      fs.writeFile(
        `./public/uploads/customForm/${customFormId}.csv`,
        csv,
        (err) => {
          if (err) {
            returnMsg = __.out(res, 300, 'Something went wrong try later');
          }

          returnMsg = __.out(res, 201, {
            csvLink: `/uploads/customForm/${customFormId}.csv`,
          });
        },
      );
      return returnMsg;
      // return __.out(res, 201, {responseBody, questionTitles});
    } catch (error) {
      return __.out(res, 300, `Something went wrong try later`);
    }
  }
}
module.exports = new CustomformController();
