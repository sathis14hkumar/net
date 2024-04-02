// Controller Code Starts here
const bcrypt = require('bcrypt-nodejs');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');
const xlsx = require('node-xlsx');
const User = require('../app/models/user');
const Roles = require('../app/models/role');
const SubSection = require('../app/models/subSection');
const Appointment = require('../app/models/appointment');
const SkillSet = require('../app/models/skillSet');
const PrivilegeCategory = require('../app/models/privilegeCategory');
const Company = require('../app/models/company');
const Role = require('../app/models/role');
const UserField = require('../app/models/userField');
const __ = require('./globalFunctions');

/* Email Credentials */

class UserBulk {
  //= ======================>>>>>>>>>>>>>>>>>>Bulk file upload<<<<<<<<<<<<<<<<<<<<<<<===========================================

  async uploadBulkUsers(req, res) {
    try {
      if (!req.file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      // Get Company Data
      const companyData = await Company.findOne({
        _id: req.user.companyId,
      }).lean();

      const excelData = xlsx.parse(req.file.path); // parses a file

      if (excelData.length > 0) {
        const userData = excelData[0].data; // get the 1st sheet only

        // Get index of Known keys from the header row
        const titleIndex = {};

        // set all unknown keys - custom fields
        const allTitles = [];

        for (const elem of userData[0]) {
          titleIndex[elem] = userData[0].indexOf(elem);
          allTitles.push(elem);
        }

        // Remove the first title && Add header
        let nonUpdatedUser = [userData[0]];

        userData.shift();

        // Get all roles/appoint/businessunit list
        const rolesData = await Roles.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();

        const appointmentsData = await Appointment.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .select('name')
          .lean();

        const skillSetsData = await SkillSet.find({
          companyId: req.user.companyId,
          status: 1,
        })
          .populate({
            path: 'subSkillSets',
            match: {
              status: 1,
            },
          })
          .select('name')
          .lean();

        const businessUnitsIds = await __.getCompanyBU(
          req.user.companyId,
          'subsection',
          1,
        );
        const businessUnitsData = await SubSection.find({
          _id: {
            $in: businessUnitsIds,
          },
        })
          .populate({
            path: 'sectionId',
            select: 'name',
            match: {
              status: 1,
            },
            populate: {
              path: 'departmentId',
              select: 'name',
              match: {
                status: 1,
              },
              populate: {
                path: 'companyId',
                select: 'name',
                match: {
                  status: 1,
                },
              },
            },
          })
          .lean();

        const staticFields = [
          'staffName',
          'staffId',
          'appointment',
          'contact',
          'email',
          'role',
          'businessUnitParent',
          'skillSets',
          'businessUnitPlan',
          'businessUnitView',
        ];

        for (const elem of userData) {
          // user Data with static fields
          const user = {
            name: elem[titleIndex.staffName],
            staffId: elem[titleIndex.staffId],
            appointmentId: elem[titleIndex.appointment],
            appointFind: false,
            contactNumber: elem[titleIndex.contact] || '',
            email: elem[titleIndex.email],
            role: elem[titleIndex.role],
            roleFind: false,
            parentBussinessUnit: elem[titleIndex.businessUnitParent],
            parentBuFind: false,
            skillSets: elem[titleIndex.skillSets]
              ? elem[titleIndex.skillSets].split(',')
              : [],
            subSkillSets: [],
            businessUnitPlan: elem[titleIndex.businessUnitPlan]
              ? elem[titleIndex.businessUnitPlan].split(',')
              : [],
            businessUnitView: elem[titleIndex.businessUnitView]
              ? elem[titleIndex.businessUnitView].split(',')
              : [],
          };

          // convert role/appoint/bu name to id
          for (const element of rolesData) {
            if (element.name === user.role) {
              user.roleFind = true;
              user.role = element._id;
            }
          }
          for (const ele of appointmentsData) {
            if (ele.name === user.appointmentId) {
              user.appointFind = true;
              user.appointmentId = ele._id;
            }
          }

          // Sub Skill Set
          for (const elems of skillSetsData) {
            for (const elem1 of elems.subSkillSets) {
              if (elem1) {
                // skkill set 1 > test sub skill set 3
                const fullString = `${elems.name}>${elem1.name}`;

                if (user.skillSets.indexOf(fullString) > -1) {
                  user.subSkillSets.push(elem1._id);
                }
              }
            }
          }

          for (const elements of businessUnitsData) {
            // SATS >> Security >> Aviation >> test 9
            const fullBU = `${elements.sectionId.departmentId.companyId.name}>${elements.sectionId.departmentId.name}>${elements.sectionId.name}>${elements.name}`;

            if (fullBU === user.parentBussinessUnit) {
              user.parentBuFind = true;
              user.parentBussinessUnitId = elements._id;
            }
          }

          const convertNametoBuId = function (namesList) {
            const idList = [];

            for (const ele1 of businessUnitsData) {
              // SATS >> Security >> Aviation >> test 9
              const fullBU = `${ele1.sectionId.departmentId.companyId.name}>${ele1.sectionId.departmentId.name}>${ele1.sectionId.name}>${ele1.name}`;

              if (namesList.indexOf(fullBU) > -1) {
                user.parentBussinessUnitId = ele1._id;
                idList.push(ele1._id);
              }
            }

            return idList;
          };

          // Convert array bu names into object ids
          user.planBussinessUnitId = convertNametoBuId(user.businessUnitPlan);
          user.viewBussinessUnitId = convertNametoBuId(user.businessUnitView);

          // Validate mail id
          const emailRegexp =
            /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

          if (!emailRegexp.test(user.email)) {
            nonUpdatedUser.push(elem);
          }

          // Validate Staff Id/Parent BU/Role/Appointment
          if (
            !user.parentBuFind ||
            !user.roleFind ||
            !user.appointFind ||
            !user.staffId
          ) {
            nonUpdatedUser.push(elem);
          }

          // Convert number to string
          if (typeof user.staffId === 'number') {
            user.staffId = user.staffId.toString();
          }

          // Update
          /* eslint-disable no-await-in-loop */
          let updatedUserData = await User.findOneAndUpdate(
            {
              companyId: req.user.companyId,
              staffId: user.staffId.toLowerCase(),
            },
            {
              $set: user,
            },
          );

          // New User
          if (!updatedUserData) {
            const generatedPassword = 'password'; // as of now default password

            user.password = bcrypt.hashSync(
              generatedPassword,
              bcrypt.genSaltSync(8),
              null,
            );
            user.status = 1;
            user.companyId = req.user.companyId;
            user.staffId = user.staffId.toLowerCase();

            updatedUserData = await new User(user).save();
            /* sending mail */

            __.log(companyData);
          }

          // Update Custom Fields
          for (const singleField of allTitles) {
            // Check Custom Field or not
            if (staticFields.indexOf(singleField) === -1) {
              const userFieldId = await UserField.findOne({
                fieldName: singleField,
                companyId: req.user.companyId,
                status: 1,
              }).lean();

              if (userFieldId) {
                // let existField = false;

                // Update if exists
                const existField = await User.update(
                  {
                    _id: updatedUserData._id,
                    'otherFields.fieldId': userFieldId._id.toString(),
                  },
                  {
                    $set: {
                      'otherFields.$.value': elem[titleIndex[singleField]],
                    },
                  },
                );

                // Add if not exists
                if (existField.nModified === 0) {
                  const newFieldData = {
                    fieldId: userFieldId._id.toString(),
                    fieldName: userFieldId.fieldName,
                    indexNum: userFieldId.indexNum,
                    options: userFieldId.options,
                    required: userFieldId.required,
                    type: userFieldId.type,
                    value: elem[titleIndex[singleField]],
                  };

                  const returnedData = await User.findOneAndUpdate(
                    {
                      _id: updatedUserData._id,
                    },
                    {
                      $addToSet: {
                        otherFields: newFieldData,
                      },
                    },
                    {
                      new: true,
                    },
                  );

                  /* eslint-enable no-await-in-loop */
                  __.log(userFieldId, returnedData);
                }
              }
            }
          }
        } // End Up for of loop

        await fs.unlink(req.file.path);

        // If missing users exists
        nonUpdatedUser = nonUpdatedUser.filter((x) => x.length);
        __.log(nonUpdatedUser);
        if (nonUpdatedUser.length > 1) {
          const buffer = xlsx.build([
            {
              name: 'Non Updated Users',
              data: nonUpdatedUser,
            },
          ]); // Returns a buffer

          const writeXls = util.promisify(fs.writeFile);
          // Random file name
          const fileName = crypto.randomBytes(8).toString('hex');

          await writeXls(`public/uploads/bulkUpload/${fileName}.xlsx`, buffer);

          return __.out(res, 201, {
            nonUpdated: true,
            fileLink: `uploads/bulkUpload/${fileName}.xlsx`,
          });
        }

        return __.out(res, 201, {
          nonUpdated: false,
        });
      }

      return __.out(res, 500, `Something went wrong`);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  // Check this user is admin or not
  async isAdmin(userData) {
    const categoryData = await PrivilegeCategory.findOne({
      name: 'System Admin',
    })
      .select('privileges')
      .lean();

    const { privileges } = categoryData;

    const systemAdminRoles = await Role.find({
      companyId: userData.companyId,
      privileges: {
        $all: privileges,
      },
    }).lean();

    __.log(systemAdminRoles, '>>>>>>>>>>>.');
    const systemAdminRolesId = systemAdminRoles.map((x) => x._id.toString());

    let result = false;

    if (systemAdminRolesId.indexOf(userData.role._id.toString()) > -1) {
      result = true;
    }

    return result;
  }
}
const user = new UserBulk();

module.exports = user;
