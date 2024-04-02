const User = require('../../models/user');
const Company = require('../../models/company');
const UserField = require('../../models/userField');
const Appointment = require('../../models/appointment');
const Role = require('../../models/role');
const PageSetting = require('../../models/pageSetting');
const Privilege = require('../../models/privilege');
const mailer = require('../../../helpers/mailFunctions');
const __ = require('../../../helpers/globalFunctions');

// Native Login
class CompanyController {
  async createCompany(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'email',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Check Email Exists
      const existCompany = await Company.findOne({
        $or: [
          {
            name: req.body.name,
          },
        ],
        status: {
          $ne: 3,
        },
      }).lean();

      if (existCompany) {
        return __.out(res, 300, 'Company Name already exists');
      }

      // __.log(req.body);
      const pathName = req.body.name.replace(/\s/g, '_').toLowerCase();
      let logoPath = '';

      if (req.file) {
        logoPath = `uploads/companyLogos/${req.file.filename}`;
      }

      const insertData1 = {
        name: req.body.name,
        email: req.body.email,
        pathName,
        logo: logoPath,
        status: 1,
      };

      const companyData = await new Company(insertData1).save();

      /* Add Custom User Fields */
      if (req.body.userFields) {
        const userFields = JSON.parse(req.body.userFields);
        const createFields = async function () {
          const promiseData = [];
          const createUserFieldsCall = async (field) => {
            const insertData = {
              fieldName: field.fieldName,
              type: field.type,
              companyId: companyData._id,
              indexNum: field.indexNum,
            };

            if (field.type === 'dropdown') {
              const optionArray = [...new Set(field.options)];

              insertData.options = optionArray;
            }

            await new UserField(insertData).save();
          };

          for (const field of userFields) {
            promiseData.push(createUserFieldsCall(field));
          }

          await Promise.all(promiseData);
        };

        await createFields();
      }
      /* End Add Custom User Fields */

      /* Create Admin User Company */
      await this.createAdmin(companyData);

      /* End Create Admin User Company */
      // Create Page Setting
      await this.createPageSetting(companyData);

      if (req.file) {
        __.scanFile(
          req.file.filename,
          `public/uploads/companyLogos/${req.file.filename}`,
        );
      }

      return __.out(res, 200, 'Tier Has Been Created');
    } catch (err) {
      // __.log(err);
      return __.out(res, 500);
    }
  }

  async companyList(req, res) {
    try {
      const searchQuery = {
        status: {
          $ne: 3,
        },
      };

      const companyList = await Company.find(searchQuery)
        .sort({
          createdAt: -1,
        })
        .lean();

      return __.out(res, 201, {
        data: companyList,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getCompany(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const searchQuery = {
        _id: req.params.companyId,
        status: {
          $ne: 3,
        },
      };
      const companyData = await Company.findOne(searchQuery).lean();

      if (!companyData) {
        return __.out(res, 300, 'Company Not Found');
      }

      // User Customisable Fields
      const userFields = await UserField.find({
        companyId: companyData._id,
        status: 1,
      })
        .sort({
          indexNum: 1,
        })
        .lean();

      // Get User Fields with assign status
      const getFields = async function () {
        // let index = 0;

        const promiseData1 = [];
        const userFieldsListCall = async (field, index) => {
          // Check Field is assigned or not
          const getUser = User.find({
            'otherFields.fieldId': field._id,
            status: {
              $ne: 3,
            },
          });

          // Set Editable Status
          if (getUser > 0) {
            userFields[index].editable = false;
          } else {
            userFields[index].editable = true;
          }

          // Incase Dropdown Field action
          if (field.type === 'dropdown') {
            const dropdownArray = async function () {
              const existingOptions = field.options;

              // Giving 2 Params. Options (not yet assigned), nonEditableFields( assigned already)
              userFields[index].nonEditableFields = [];
              userFields[index].options = [];

              const promiseData = [];
              const existingOptionsCall = async (elem) => {
                __.log(elem);
                const fieldData = User.find({
                  'otherFields.fieldId': field._id,
                  'otherFields.value': elem,
                  status: {
                    $ne: 3,
                  },
                });

                if (fieldData && fieldData.length > 0) {
                  userFields[index].nonEditableFields.push(elem);
                } else {
                  userFields[index].options.push(elem);
                }
              };

              for (const elem of existingOptions) {
                promiseData.push(existingOptionsCall(elem));
              }

              await Promise.all(promiseData);
            };

            await dropdownArray();
          }
        };

        for (let index = 0; index < userFields.length; index += 1) {
          promiseData1.push(userFieldsListCall(userFields[index], index));
        }
        await Promise.all(promiseData1);

        // End for loop
      };

      await getFields();

      companyData.userFields = userFields;

      return __.out(res, 201, companyData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async updateCompany(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'companyId',
        'name',
        'email',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      // Check Email Exists
      const existCompany = await Company.findOne({
        _id: {
          $ne: req.body.companyId,
        },
        $or: [
          {
            email: req.body.email,
          },
          {
            name: req.body.name,
          },
        ],
        status: {
          $ne: 3,
        },
      });

      if (existCompany) {
        if (existCompany.email === req.body.email) {
          return __.out(res, 300, 'Email already exists');
        }

        return __.out(res, 300, 'Company Name already exists');
      }

      // Get Company Details
      const companyData = await Company.findOne({
        _id: req.body.companyId,
        status: {
          $ne: 3,
        },
      });

      if (!companyData) {
        return __.out(res, 300, 'Company Not Found');
      }

      // Update Data
      companyData.name = req.body.name;
      companyData.email = req.body.email;
      companyData.pathName = req.body.name.replace(/\s/g, '_').toLowerCase();
      companyData.status = req.body.status;

      if (req.file && req.file !== '') {
        __.log(`public/${companyData.logo}`);

        companyData.logo = `uploads/companyLogos/${req.file.filename}`;
        __.log(companyData.logo, 'as');
      }

      __.log(req.file);
      await companyData.save();

      return __.out(res, 200, 'Company Has Been Updated');
    } catch (err) {
      __.log(err);
      return __.out(res, 500, 'Something Went Wrong !!');
    }
  }

  async deleteCompany(req, res) {
    try {
      if (!__.checkHtmlContent(req.params)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { companyId } = req.params;

      // Get Company Details
      const companyData = await Company.findOne({
        _id: companyId,
        status: {
          $ne: 3,
        },
      });

      if (!companyData) {
        return __.out(res, 300, 'Company Not Found');
      }

      // Update Data
      companyData.status = 3;
      await companyData.save();

      return __.out(res, 200, 'Company Has Been Deleted');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async createAdmin(companyData) {
    /* Create Password */
    const generatedPassword = await __.makePwd(8);
    /* User Fields */
    const insert = {};

    const data = companyData.email.split('@');
    const [name] = data;

    insert.name = name;
    insert.staffId = 'admin001';
    insert.email = companyData.email;
    insert.companyId = companyData._id;
    insert.status = 1;

    /* Create Company Role && Add this User */
    // Get All Company Ids
    const privilege = await Privilege.find({
      status: 1,
    }).select('_id');
    const privilegeIds = [];

    for (const elem of privilege) {
      privilegeIds.push(elem._id);
    }
    __.log(privilegeIds);
    // Create Appointment
    const insertAppoint = {
      name: 'System Admin',
      companyId: companyData._id,
      status: 1,
    };
    const appointmentId = await new Appointment(insertAppoint).save();

    insert.appointmentId = appointmentId._id;
    // Create Role with all previleges
    const insertRole = {
      status: 1,
      name: 'System Admin',
      description: 'System Administrator',
      companyId: companyData._id,
      isFlexiStaff: 0,
      privileges: privilegeIds,
    };
    const roleId = await new Role(insertRole).save();

    insert.role = roleId._id;
    __.log(insert);
    // create new model
    const post = await new User(insert);

    post.password = post.generateHash(generatedPassword);

    // save model to MongoDB
    const insertedUser = await post.save();

    /* sending mail */
    const mailDoc = {
      email: insertedUser.email,
      userName: insertedUser.name,
      staffId: insertedUser.staffId,
      password: generatedPassword,
      companyData,
    };

    await mailer.newCompanyUser(mailDoc);
  }

  async createPageSetting(companyData, res) {
    try {
      const newData = {
        companyId: companyData._id,
        bannerImages: [],
        quickLinks: [],
        externalLinks: [],
        status: 1,
      };

      return await new PageSetting(newData).save();
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}
const company = new CompanyController();

module.exports = company;
