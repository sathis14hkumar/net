/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable new-cap */
/* eslint-disable camelcase */
const Agenda = require('agenda');
const moment = require('moment');
const mongoose = require('mongoose');
const fs = require('fs');
const Client = require('ssh2-sftp-client');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');

const json2csv = require('json2csv').parse;

const { spawn } = require('child_process');
const csv = require('csv-parser');
const parser = require('html-to-text');

const SubSection = require('../app/models/subSection');
const Appointment = require('../app/models/appointment');
const Role = require('../app/models/role');

const Notification = require('../app/models/notification');
const Post = require('../app/models/post');
const Channel = require('../app/models/channel');
const Company = require('../app/models/company');
const Forms = require('../app/models/customForms');

const Department = require('../app/models/department');
const Section = require('../app/models/section');

const Integration = require('../app/models/integration');
const User = require('../app/models/user');
const UserField = require('../app/models/userField');
const Wall = require('../app/models/wall');
const WallPost = require('../app/models/wallPost');
const WallCategory = require('../app/models/wallCategory');
const PageSettingModel = require('../app/models/pageSetting');
const LeaveGroupModel = require('../app/models/leaveGroup');
const FCM = require('./fcm');
const mailer = require('./mailFunctions');
const Challenge = require('../app/models/challenge');
// UserUpdate = require('./userUpdate'),
const __ = require('./globalFunctions');

const staffLeave = require('../app/models/staffLeave');
const LeaveType = require('../app/models/leaveType');
const LeaveApplied = require('../app/models/leaveApplied');
const LeaveGroup = require('../app/models/leaveGroup');
const { AssignUserRead } = require('./assinguserread');
const { logInfo, logError } = require('./logger.helper');

const createStaffLeave = async (data) => {
  const leaveGroupData = await LeaveGroup.findOne({
    _id: data.leaveGroupId,
  }).populate([
    {
      path: 'leaveType.leaveTypeId',
      match: {
        isActive: true,
      },
    },
  ]);

  function monthDiff(d1, d2) {
    let months;

    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
  }

  function diff_years(dt2, dt1) {
    let diff = (dt2.getTime() - dt1.getTime()) / 1000;

    diff /= 60 * 60 * 24;
    return Math.abs(Math.round(diff / 365.25));
  }

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const prevYear = currentYear - 1;
  const yearArr = [prevYear, currentYear, nextYear];

  const leaveDetails = [];

  for (let i = 0; i < 3; i += 1) {
    const yearValue = yearArr[i];
    let month = 0;
    let year = 0;

    if (data.doj) {
      month = monthDiff(
        new Date(data.doj),
        new Date(new Date().setFullYear(yearValue)),
      );
      year = diff_years(
        new Date(data.doj),
        new Date(new Date().setFullYear(yearValue)),
      );
    }

    leaveGroupData.leaveType.forEach((leave) => {
      if (leave.leaveTypeId) {
        let { quota } = leave;

        if (month > 0) {
          leave.proRate.forEach((mo) => {
            if (
              mo.fromMonth <= month &&
              mo.toMonth >= month &&
              quota < mo.quota
            ) {
              quota = mo.quota;
            }
          });
        }

        if (year > 0) {
          leave.seniority.forEach((mo) => {
            if (mo.year <= year && quota < mo.quota) {
              quota = mo.quota;
            }
          });
        }

        const leaveObj = {
          leaveTypeId: leave.leaveTypeId._id,
          quota,
          planQuota: quota,
          planDymanicQuota: quota,
          total: quota,
          year: yearValue,
        };

        leaveDetails.push(leaveObj);
      }
    });
  }

  const obj = {
    userId: data._id,
    leaveGroupId: data.leaveGroupId,
    businessUnitId: data.parentBussinessUnitId,
    leaveDetails,
  };
  const post = new staffLeave(obj);

  await post.save();
};

const updateStaffLeave = async (data) => {
  const leaveGroupData = await LeaveGroup.findOne({
    _id: data.leaveGroupId,
  }).populate([
    {
      path: 'leaveType.leaveTypeId',
      match: {
        isActive: true,
      },
    },
  ]);

  function monthDiff(d1, d2) {
    let months;

    months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 0 : months;
  }

  function diff_years(dt2, dt1) {
    let diff = (dt2.getTime() - dt1.getTime()) / 1000;

    diff /= 60 * 60 * 24;
    return Math.abs(Math.round(diff / 365.25));
  }
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const prevYear = currentYear - 1;
  const yearArr = [prevYear, currentYear, nextYear];

  const leaveDetails = [];

  for (let i = 0; i < yearArr.length; i += 1) {
    const yearValue = yearArr[i];
    let month = 0;
    let year = 0;

    if (data.doj) {
      month = monthDiff(
        new Date(data.doj),
        new Date(new Date().setFullYear(yearValue)),
      );
      year = diff_years(
        new Date(data.doj),
        new Date(new Date().setFullYear(yearValue)),
      );
    }

    if (leaveGroupData) {
      leaveGroupData.leaveType.forEach((leave) => {
        if (leave.leaveTypeId) {
          let { quota } = leave;

          if (month > 0) {
            leave.proRate.forEach((mo) => {
              if (
                mo.fromMonth <= month &&
                mo.toMonth >= month &&
                quota < mo.quota
              ) {
                quota = mo.quota;
              }
            });
          }

          if (year > 0) {
            leave.seniority.forEach((mo) => {
              if (mo.year <= year && quota < mo.quota) {
                quota = mo.quota;
              }
            });
          }

          const leaveObj = {
            leaveTypeId: leave.leaveTypeId._id,
            quota,
            planQuota: quota,
            planDymanicQuota: quota,
            total: quota,
            year: yearValue,
          };

          leaveDetails.push(leaveObj);
        }
      });
    }
  }

  const staffLeaveData = await staffLeave.findOne({
    userId: data._id,
  });

  if (staffLeaveData) {
    for (let i = 0; i < leaveDetails.length; i += 1) {
      const leaveType = leaveDetails[i];
      let staffLeaveType = staffLeaveData.leaveDetails.filter(
        (lt) =>
          lt.leaveTypeId.toString() === leaveType.leaveTypeId.toString() &&
          lt.year === leaveType.year,
      );

      if (staffLeaveType && staffLeaveType.length > 0) {
        [staffLeaveType] = staffLeaveType;
        // 1000 - 20 => 980
        // 20+980 =>
        // 15+980 = 995
        // 20-1000 => -980
        const totalLeaveIncrease = leaveType.total - staffLeaveType.total;
        const quotaIncrease = staffLeaveType.quota + totalLeaveIncrease;
        const planIncrease = staffLeaveType.planQuota + totalLeaveIncrease;

        leaveDetails[i].quota = quotaIncrease > 0 ? quotaIncrease : 0;
        leaveDetails[i].planQuota = planIncrease > 0 ? planIncrease : 0;
      }
    }
    const obj = {
      userId: data._id,
      // updatedBy: req.user._id,
      leaveGroupId: data.leaveGroupId,
      businessUnitId: data.parentBussinessUnitId,
      // companyId: req.user.companyId,
      leaveDetails,
    };

    await staffLeave.findOneAndUpdate(
      {
        userId: obj.userId,
      },
      {
        $set: {
          leaveDetails: obj.leaveDetails,
          updatedBy: obj.updatedBy,
          leaveGroupId: obj.leaveGroupId,
          isActive: true,
        },
      },
    );
  }
};

const integration = async (resDaily) => {
  try {
    const serverFile = `./public/${resDaily}`;
    const columns = [
      'SNo',
      'EmployeeNumber',
      'SamAccountName',
      'DisplayName',
      'GivenName',
      'Surname',
      'EmailAddress',
      'Company',
      'Department',
      'Title',
      'Reporting Officer',
      'MobilePhone',
      'OfficePhone',
      'Office',
      'UserAccountControl',
      'Password',
    ];
    const staticFields = [
      'EmployeeNumber',
      'DisplayName',
      'EmailAddress',
      'Company',
      'Department',
      'Title',
      'Tech',
      'MobilePhone',
      'UserAccountControl',
      'Password',
    ];
    let companyData = null;
    const getCompanyData = async (elem) => {
      const pathName = elem.EmployeeNumber.includes('MySATS') ? 'sats' : '';

      companyData = await Company.findOne({
        pathName,
      }).lean();
      return !!companyData;
    };
    const results = [];
    const leaveGroupData = await LeaveGroupModel.findOne({
      name: 'SATS Standard',
    }).lean();

    try {
      if (fs.existsSync(serverFile)) {
        // do nothing
      } else {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'Integration main - file not exists',
            date: new Date(),
          }),
        );
        await new Integration({
          newUsers: [],
          status: 'Success',
          sourcePath: null,
          errorFilePath: null,
          updatedUsers: [],
          errorMessage: `integration file not exists... :${serverFile}`,
        }).save();
        return;
      }
    } catch (err) {
      // Hariharan
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'Integration main - error file log',
          date: new Date(),
          detail: `${err}`,
        }),
      );
      logError(err);
    }
    fs.createReadStream(serverFile)
      .pipe(csv(columns))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const logData = {
          newUsers: [],
          status: 'Success',
          sourcePath: null,
          errorFilePath: null,
          updatedUsers: [],
          errorMessage: '',
        };
        const excelData = results || [];
        const nonUpdated = [];

        if (excelData.length) {
          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'Integration main - file data available',
              date: new Date(),
            }),
          );
          const company = await getCompanyData(excelData[0]);

          if (!company) {
            return;
          }

          const companyId = companyData._id;

          logData.companyId = companyId;
          const businessUnitsIds = await __.getCompanyBU(
            companyData._id,
            'subsection',
            1,
          );
          const buQuery = __.buQuery('sectionId');
          let businessUnitsData = await SubSection.find({
            _id: {
              $in: businessUnitsIds,
            },
          })
            .populate(buQuery)
            .lean();
          // const systemAdminRoles = await Role.find({ companyId: companyId, privileges: { $all: categoryData.privileges } }).select('_id').lean();
          const systemAdminRoles = await Role.find({
            companyId,
            name: 'System Admin',
          })
            .select('_id')
            .lean();
          const systemAdminRolesIds = systemAdminRoles.map((v) => v._id);

          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'Integration main - file data iteration starts',
              date: new Date(),
            }),
          );
          for (const elem of excelData) {
            if (elem.EmployeeNumber === 'dailyMySATS' || elem.SNo === '99') {
              continue;
            }
            // else

            let appointment = elem.Title ? `${elem.Title}` : `${'__'}`;
            const status =
              {
                512: 1,
                66048: 1,
                546: 2,
              }[elem.UserAccountControl] || 0;

            companyData.name = companyData.name.toUpperCase();
            elem.Company = elem.Company
              ? elem.Company.trim().toUpperCase()
              : elem.Company;
            elem.Department = elem.Department
              ? elem.Department.toUpperCase()
              : null;
            const bu = elem.Department
              ? `${companyData.name}>${elem.Company}>${elem.Department}>${'__'}`
              : `${companyData.name}>${elem.Company}>${'__'}>${'__'}`;
            const user = {
              name: elem.DisplayName,
              staffId: elem.EmployeeNumber.toLowerCase(),
              contactNumber: elem.MobilePhone,
              email: elem.EmailAddress || 'mysats@net-roc.com',
              status,
              role: null,
              roleFind: false,
              appointmentId: null,
              appointFind: false,
              parentBussinessUnitId: null,
              parentBuFind: false,
            };
            const businessUnitId = businessUnitsData.find(
              (elemI) =>
                `${elemI.sectionId.departmentId.companyId.name}>${elemI.sectionId.departmentId.name}>${elemI.sectionId.name}>${elemI.name}`.toUpperCase() ===
                bu,
            );

            if (businessUnitId) {
              user.parentBuFind = true;
              user.parentBussinessUnitId = businessUnitId._id;
            }

            const reasons = [];

            if (!elem.Company) {
              reasons[reasons.length] = 'Company Name Missing';
            }

            if (!elem.EmployeeNumber) {
              reasons[reasons.length] = 'Employee Number MisMatch';
            }

            if (!elem.DisplayName) {
              reasons[reasons.length] = 'Staff Name MisMatch';
            }

            let name = '';

            if (appointment.includes('(')) {
              name = appointment.trim();
            } else {
              appointment = appointment.replace(/\\/g, ',');
              name = new RegExp(`^${appointment}$`, 'i');
            }

            if (reasons.length) {
              nonUpdated[nonUpdated.length] = {
                EmployeeNumber: elem.EmployeeNumber,
                DisplayName: elem.DisplayName,
                MobilePhone: elem.MobilePhone,
                EmailAddress: elem.EmailAddress,
                Reason: reasons.join(`, `),
              };
              continue;
            }

            //            appointment = appointment.replace(/\\/g, ",");
            // Appointment Exist or Not...
            const appointmentsData = await Appointment.findOne({
              companyId: companyData._id,
              name, // : new RegExp(`^${appointment}$`, 'i'),
              status: 1,
            })
              .select('name')
              .lean();

            if (appointmentsData) {
              user.appointmentId = appointmentsData._id;
            } else {
              const insertedDoc = await new Appointment({
                name: appointment.trim(),
                status: 1,
                companyId,
              }).save();

              user.appointmentId = insertedDoc._id;
            }

            const pageSetting = await PageSettingModel.findOne({
              companyId,
            })
              .populate({
                path: 'buTemplateId',
              })
              .lean();
            const findActiveBuTemplate = pageSetting.buTemplateId;
            let newBu = false;

            if (!user.parentBussinessUnitId) {
              // find department..
              const departmentIds = await Department.find({
                companyId,
                name: elem.Company.trim(), // new RegExp(`^${elem.Company}$`, 'i'),
                status: {
                  $in: status,
                },
              })
                .select('_id')
                .lean();
              let departmentId = null;

              if (departmentIds.length) {
                departmentId = departmentIds[0]._id;
              } else {
                const insertedDepartment = await new Department({
                  companyId,
                  name: elem.Company.trim(),
                  status: 1,
                }).save();

                departmentId = insertedDepartment._id;
              }

              const cmpy = await Company.findOneAndUpdate(
                {
                  _id: companyId,
                },
                {
                  $addToSet: {
                    departments: departmentId,
                  },
                },
              );

              /** Find Section */
              const sectionIds = await Section.find({
                departmentId: {
                  $in: [departmentId],
                },
                name: elem.Department ? elem.Department.trim() : '__', // new RegExp(`^${elem.Department}$`, 'i'),
                status: {
                  $in: [status],
                },
              })
                .select('_id')
                .lean();
              let sectionId = null;

              if (sectionIds.length) {
                sectionId = sectionIds[0]._id;
              } else {
                const insertedSection = await new Section({
                  departmentId,
                  name: elem?.Department?.trim() || '__',
                  status: 1,
                }).save();

                sectionId = insertedSection._id;
              }

              await Department.update(
                {
                  _id: departmentId,
                },
                {
                  $addToSet: {
                    sections: sectionId,
                  },
                },
              );
              // Sub Section
              const subSectionIds = await SubSection.find({
                sectionId: {
                  $in: [sectionId],
                },
                name: '__',
                status: {
                  $in: [status],
                },
              })
                .select('_id')
                .lean();

              // create new model
              let subsectionId = null;

              if (subSectionIds.length) {
                subsectionId = subSectionIds[0]._id;
              } else {
                const {
                  subCategories,
                  techEmail,
                  adminEmail,
                  notificRemindHours,
                  notificRemindDays,
                  cancelShiftPermission,
                  standByShiftPermission,
                  reportingLocation,
                } = findActiveBuTemplate;
                const insertedSubSection = await new SubSection({
                  name: '__',
                  sectionId,
                  appointments: [user.appointmentId],
                  subCategories,
                  techEmail,
                  adminEmail,
                  notificRemindHours,
                  notificRemindDays,
                  cancelShiftPermission,
                  standByShiftPermission,
                  reportingLocation,
                  status: 1,
                  orgName: `${cmpy.name} > ${elem.Company} > ${
                    elem.Department || '__'
                  } > __`,
                }).save();

                subsectionId = insertedSubSection._id;
              }

              await Section.update(
                {
                  _id: sectionId,
                },
                {
                  $addToSet: {
                    subSections: subsectionId,
                  },
                },
              );
              user.parentBussinessUnitId = subsectionId;
              newBu = true;
              businessUnitsData = await SubSection.find({
                _id: {
                  $in: businessUnitsIds,
                },
              })
                .populate(buQuery)
                .lean();
            } else {
              await SubSection.update(
                {
                  _id: user.parentBussinessUnitId,
                },
                {
                  $addToSet: {
                    appointments: user.appointmentId,
                  },
                },
              );
            }

            if (typeof user.staffId === 'number') {
              user.staffId = user.staffId.toString();
            }

            const addToSystemAdmin = async () => {
              // await User.update({ role: { $in: systemAdminRolesIds }, companyId: companyId }, {
              await User.update(
                {
                  $or: [
                    {
                      role: {
                        $in: systemAdminRolesIds,
                      },
                    },
                    {
                      allBUAccess: 1,
                    },
                  ],
                  companyId,
                },
                {
                  // changed from systemadmin to allBUAccess users
                  $addToSet: {
                    planBussinessUnitId: user.parentBussinessUnitId,
                    viewBussinessUnitId: user.parentBussinessUnitId,
                  },
                },
                {
                  multi: true,
                },
              );
            };

            const userDe = await User.findOne({
              companyId,
              staffId: user.staffId.toLowerCase(),
            })
              .select('staffId role subSkillSets leaveGroupId')
              .lean();

            user.name = user.name.replace(/\\/g, ',');
            let updatedUserData;

            if (userDe) {
              user.role = userDe.role;
              user.subSkillSets = userDe.subSkillSets;
              if (elem.Password) {
                const userNew = new User();

                user.password = userNew.generateHash(elem.Password);
              }

              // adding leave group to new user
              if (
                !userDe.leaveGroupId &&
                leaveGroupData &&
                leaveGroupData._id
              ) {
                user.leaveGroupId = leaveGroupData._id;
                const requestBody = {
                  ...user,
                  ...userDe,
                };

                await updateStaffLeave(requestBody);
              }

              updatedUserData = await User.findOneAndUpdate(
                {
                  companyId,
                  staffId: user.staffId.toLowerCase(),
                },
                {
                  $set: user,
                },
                {
                  setDefaultsOnInsert: true,
                },
              ).lean();
              logData.updatedUsers[logData.updatedUsers.length] = user.staffId;
              if (newBu) {
                /* add created business unit to System admin's plan business unit */
                await addToSystemAdmin();
              }

              const getAllBuTokensByUserID = async (userData) => {
                const userId = userData._id;
                const condition = {
                  createdBy: userId,
                  'assignUsers.allBuToken': true,
                };
                const channels = await Channel.find({
                  createdBy: userId,
                  'userDetails.allBuToken': true,
                });
                const boards = await Wall.find(condition);
                const notifications = await Notification.find(condition);
                const forms = await Forms.find(condition);

                if (channels) {
                  for (const channel of channels) {
                    channel.userDetails[0].businessUnits =
                      userData.planBussinessUnitId;
                    await Channel.findOneAndUpdate(
                      {
                        _id: channel._id,
                      },
                      {
                        userDetails: channel.userDetails,
                      },
                    );
                  }
                }

                if (boards) {
                  for (const board of boards) {
                    board.assignUsers[0].businessUnits =
                      userData.planBussinessUnitId;
                    await Wall.findOneAndUpdate(
                      {
                        _id: board._id,
                      },
                      {
                        assignUsers: board.assignUsers,
                      },
                    );
                  }
                }

                if (notifications) {
                  for (const notification of notifications) {
                    notification.assignUsers[0].businessUnits =
                      userData.planBussinessUnitId;
                    await Notification.findOneAndUpdate(
                      {
                        _id: notification._id,
                      },
                      {
                        assignUsers: notification.assignUsers,
                      },
                    );
                  }
                }

                if (forms) {
                  for (const form of forms) {
                    form.assignUsers[0].businessUnits =
                      userData.planBussinessUnitId;
                    await Forms.findOneAndUpdate(
                      {
                        _id: form._id,
                      },
                      {
                        assignUsers: form.assignUsers,
                      },
                    );
                  }
                }
              };

              await getAllBuTokensByUserID(updatedUserData);
            } else {
              let generatedPassword = await __.makePwd(8);

              user.role = findActiveBuTemplate.role;
              user.subSkillSets = findActiveBuTemplate.subSkillSets;
              const userNew = new User();

              if (pageSetting.pwdSettings.status === 1) {
                if (pageSetting.pwdSettings.passwordType === 2) {
                  generatedPassword = pageSetting.pwdSettings.defaultPassword;
                  user.password = userNew.generateHash(generatedPassword);
                } else {
                  user.password = userNew.generateHash(generatedPassword);
                }
              } else {
                user.password = userNew.generateHash(generatedPassword);
              }

              user.companyId = companyId;
              user.staffId = user.staffId.toLowerCase();
              user.companyData = companyData;
              logData.newUsers[logData.newUsers.length] = user.staffId;
              // adding leave group to new user
              if (leaveGroupData && leaveGroupData._id) {
                user.leaveGroupId = leaveGroupData._id;
                updatedUserData = await User(user).save();
                if (updatedUserData && updatedUserData._id) {
                  user._id = updatedUserData._id;
                  await createStaffLeave(user);
                }
              }

              // For Mail
              user.password = generatedPassword;
              await mailer.newCompanyUser(user);

              /* add created business unit to System admin's plan business unit */
              await addToSystemAdmin();
            }

            /**  */
            for (const singleField of columns) {
              if (singleField === 'SamAccountName' || singleField === 'SNo') {
                continue;
              }

              if (!staticFields.includes(singleField)) {
                const userFieldId = await UserField.findOne({
                  fieldName: singleField,
                  companyId,
                  status: 1,
                }).lean();

                /** Field exists */
                if (userFieldId) {
                  // let existField = false;

                  // Update if exists
                  elem[singleField] = elem[singleField].replace(/\\/g, ',');
                  await User.update(
                    {
                      _id: updatedUserData._id,
                      'otherFields.fieldId': userFieldId._id.toString(),
                    },
                    {
                      $set: {
                        'otherFields.$.value': elem[singleField],
                        'otherFields.$.type': userFieldId.type,
                      },
                    },
                  );

                  const existOrNot = await User.findOne({
                    _id: updatedUserData._id,
                    'otherFields.fieldId': userFieldId._id.toString(),
                  }).lean();

                  // Add if not exists
                  if (!existOrNot) {
                    const newFieldData = {
                      fieldId: userFieldId._id.toString(),
                      fieldName: userFieldId.fieldName,
                      indexNum: userFieldId.indexNum,
                      required: userFieldId.required,
                      type: userFieldId.type,
                      value: elem[singleField],
                    };

                    await User.update(
                      {
                        _id: updatedUserData._id,
                      },
                      {
                        $addToSet: {
                          otherFields: newFieldData,
                        },
                      },
                    );
                  }
                } else {
                  const insertField = {
                    fieldName: singleField,
                    companyId,
                    type: 'text',
                    indexNum: 1,
                    editable: false,
                  };

                  if (insertField.type === 'dropdown') {
                    const optionArray = elem[singleField];

                    insertField.options = optionArray;
                  }

                  const newField = await new UserField(insertField).save();

                  if (newField) {
                    newField.options = newField.options.replace(/\\/g, ',');
                    const newFieldData = {
                      fieldId: newField._id.toString(),
                      fieldName: newField.fieldName,
                      indexNum: newField.indexNum,
                      required: newField.required,
                      type: newField.type,
                      value: elem[singleField],
                    };

                    await User.update(
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
                  }
                }
              }
            }
          }
        } else {
          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'Integration main - no records in file',
              date: new Date(),
            }),
          );
          logData.errorMessage += `
                No record found`;
        }

        let csvLink = '';
        const fieldsArray = [
          'EmployeeNumber',
          'DisplayName',
          'EmailAddress',
          'MobilePhone',
          'Reason',
        ];

        logData.nonUpdatedUsers = nonUpdated.map((v) => v.Reason);
        logData.sourcePath = resDaily;
        if (nonUpdated.length) {
          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'Integration main - non updated users available',
              date: new Date(),
            }),
          );
          const fileName = `NonUpdatedData${moment().format('YYYYMMDD')}`;

          logData.errorFilePath = `uploads/${fileName}.csv`;
          logData.status = 'Partially completed';
          const csvI = json2csv({
            data: nonUpdated,
            fields: fieldsArray,
          });

          await fs.writeFile(
            `./public/uploads/${fileName}.csv`,
            csvI,
            async (err) => {
              if (err) {
                // Hariharan
                await fs.appendFileSync(
                  './public/integration/integration.log',
                  JSON.stringify({
                    message:
                      'Integration main - error while create non update user file',
                    date: new Date(),
                    detail: `${err}`,
                  }),
                );
                __.log(`json2csv err${err}`);
              } else {
                csvLink = `uploads/${fileName}.csv`;
                logData.errorFilePath = csvLink;
                const fileLocation = `./public/${csvLink}`;
                const transporter = nodemailer.createTransport(
                  smtpTransport({
                    service: 'Office365',
                    host: 'smtp.office365.com',
                    port: 587,
                    secure: false,
                    requireTLS: true,
                    auth: {
                      user: process.env.NODEMAILER_EMAIL,
                      pass: process.env.NODEMAILER_PASSWORD,
                    },
                  }),
                );

                fs.readFile(fileLocation, async (errI, data) => {
                  await transporter.sendMail({
                    sender: process.env.NODEMAILER_EMAIL,
                    to: 'siangju@net-roc.com', // process.env.NODEMAILER_EMAIL,
                    subject: 'Attachment!',
                    body: 'mail content...',
                    attachments: [
                      {
                        filename: 'attachment.csv',
                        content: data,
                      },
                    ],
                  });
                });
              }
            },
          );
        }

        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'Integration main - creating integration log',
            date: new Date(),
          }),
        );
        await new Integration(logData).save();
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'Integration main - creating integration log done',
            date: new Date(),
          }),
        );
      });
  } catch (error) {
    // Hariharan
    await fs.appendFileSync(
      './public/integration/integration.log',
      JSON.stringify({
        message: 'Integration main - error in core',
        date: new Date(),
        detail: `${error}`,
      }),
    );
    __.log(error);
  }
};

class cron {
  async challengeNotification() {
    try {
      let challenges = await Challenge.find({
        status: 1,
        criteriaType: {
          $nin: [3, 4, 5],
        },
        isNotified: false,
        publishStart: {
          $lte: new Date(),
        },
      })
        .select({
          _id: 1,
          title: 1,
          description: 1,
          selectedChannel: 1,
          selectedWall: 1,
          criteriaType: 1,
        })
        .lean();

      challenges = challenges || [];
      const sendNotification = async (challenge, users) => {
        const collapseKey = challenge._id;
        const usersWithToken = await User.find({
          _id: {
            $in: users || [],
          },
        })
          .select('deviceToken')
          .lean();
        const pushData = {
          title: challenge.title,
          body: challenge.description,
          redirect: 'challenges',
        };
        const deviceTokens = usersWithToken
          .map((user) => user.deviceToken)
          .filter(Boolean);

        if (deviceTokens.length) {
          await FCM.push(deviceTokens, pushData, collapseKey);
        }
      };

      if (challenges.length) {
        for (const challenge of challenges) {
          let users = [];

          /** get the users for wall/channal */
          if (!!challenge.selectedChannel && challenge.criteriaType === 1) {
            const channel = await Channel.findOne({
              _id: challenge.selectedChannel,
            })
              .select('userDetails createdBy')
              .lean();

            users = await AssignUserRead.read(
              channel.userDetails,
              null,
              channel.createdBy,
            );
            users = users.users;
          } else if (!!challenge.selectedWall && challenge.criteriaType === 2) {
            const wall = await Wall.findOne({
              _id: challenge.selectedWall,
            })
              .select('assignUsers createdBy')
              .lean();

            users = await AssignUserRead.read(
              wall.assignUsers,
              null,
              wall.createdBy,
            );
            users = users.users;
          }

          if (users.length) {
            await sendNotification(challenge, users);
          }

          await Challenge.findByIdAndUpdate(challenge._id, {
            isNotified: true,
          });
        }
      }
    } catch (error) {
      __.log(error);
    }
  }

  async notification() {
    const notificationDetails = await Notification.find({
      activeFrom: {
        $lte: moment().utc().format(),
      },
      status: 1,
      isSent: 0,
      notifyOverAllUsers: {
        $ne: [],
      },
    })
      .populate({
        path: 'notifyOverAllUsers',
        select: 'deviceToken',
        match: {
          status: 1,
          deviceToken: {
            $ne: '',
          },
        },
      })
      .lean();

    for (const eachNotification of notificationDetails) {
      const usersDeviceTokens = eachNotification.notifyOverAllUsers
        .map((x) => x.deviceToken)
        .filter(Boolean);

      if (usersDeviceTokens.length > 0) {
        await Notification.update(
          {
            _id: eachNotification._id,
          },
          {
            $set: {
              isSent: 1,
            },
          },
        );
        const pushData = {
          title: eachNotification.title,
          body: eachNotification.subTitle,
          redirect: 'notifications',
        };
        const collapseKey = eachNotification._id;

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
  }

  // News/Event Publishing
  async publishingPost() {
    /* let activeChannels = [];
    let channelUsers = {};

    // Active Channel
    let channelList = await Channel.find({
        status: 1
    }).lean(); */

    // Make Object for Users list for corresponding channel
    /**
      channelUsers = {
            "channeId":[ 'array of usersTokens' ],
            "channeId":[ 'array of usersTokens' ]
      }  
    */
    /* for (let channel of channelList) {
        let userTokens = [];
        let userIds = await __.channelUsersList(channel);
        if (userIds.length > 0) {
            let userData = await User.find({
                _id: {
                    $in: userIds
                }
            }).lean();
            for (let singleUser of userData) {
                if (singleUser.deviceToken && singleUser.deviceToken !== '') {
                    userTokens.push(singleUser.deviceToken);
                }
            }
        }
        channelUsers[channel._id] = userTokens;
        activeChannels.push(channel._id);
    } */

    // Get Posts
    const searchQuery = {
      // channelId: {
      //     $in: activeChannels
      // },
      status: 1,
      'publishing.startDate': {
        $lte: moment().utc().format(),
      },
      'publishing.endDate': {
        $gte: moment().utc().format(),
      },
      notifiedSent: false,
    };

    const postList = await Post.find(searchQuery)
      .populate({
        path: 'authorId',
        select: '_id name',
      })
      .populate({
        path: 'channelId',
        select: '_id name',
        match: {
          status: 1,
        },
      })
      .populate({
        path: 'categoryId',
        select: '_id name',
        match: {
          status: 1,
        },
      })
      .sort({
        createdAt: 1,
      })
      .lean();

    for (const post of postList) {
      // Active Categories && Channels
      if (post.channelId != null && post.categoryId != null) {
        const decodedString = parser.convert(post.content.title, {
          wordwrap: 130,
        });
        // let dom = parser.parseFromString(post.content.title), decodedString = dom.body.textContent;
        const pushData = {
          title: __.toTitleCase(post.postType),
          body: decodedString,
          redirect: 'post',
        };
        const collapseKey = post._id;
        const channel = await Channel.findOne({
          _id: post.channelId._id,
          status: 1,
        })
          .select('userDetails')
          .lean();

        if (channel) {
          let userIds = await AssignUserRead.read(
            channel.userDetails,
            { _id: 1, name: 1, staffId: 1, deviceToken: 1, otherFields: 1 },
            null,
          );

          userIds = userIds.users;
          const deviceTokens = userIds
            .filter((v) => !!v.deviceToken)
            .map((v) => v.deviceToken);

          if (deviceTokens.length) {
            const channeluserTokens = deviceTokens;

            FCM.push(channeluserTokens, pushData, collapseKey);
            await Post.update(
              {
                _id: post._id,
              },
              {
                $set: {
                  notifiedSent: true,
                },
              },
            );
          }
        }
      }
      // Update Post Notification Already Sent
    }
  }

  // Notification Reminder - If user not yet read within particular BU timing
  async notificationReminder() {
    try {
      // Get all Active Companies
      const companyList = await Company.find({
        status: 1,
      })
        .select('name email logo')
        .lean();

      for (const companyData of companyList) {
        // Get all active BU
        const bussinessUnitIds = await __.getCompanyBU(
          companyData._id,
          'subsection',
          [1],
        );

        // Get all Notifications
        const matchQuery = {
          businessUnitId: {
            $in: bussinessUnitIds,
          },
          activeFrom: {
            $lt: moment().utc().format(),
          },
          activeTo: {
            $gt: moment().utc().format(),
          },
          lastNotified: {
            $lt: moment().utc().format(),
          },
          notifyUnreadUsers: {
            $gt: [],
          },
          isSent: 1,
          status: 1,
        };
        const notificationList = await Notification.find(matchQuery)
          .populate({
            path: 'businessUnitId',
            select: 'notificRemindDays notificRemindHours',
          })
          .populate({
            path: 'notifyUnreadUsers',
            select: 'staffId email deviceToken',
            match: {
              status: 1,
              deviceToken: {
                $ne: '',
              },
            },
          })
          .select(
            'title subTitle notifyUnreadUsers activeFrom activeTo businessUnitId lastNotified',
          )
          .lean();

        for (const notificationData of notificationList) {
          const notificationId = notificationData._id;
          const activeFrom = moment(notificationData.activeFrom).format();
          const remindHours =
            notificationData.businessUnitId.notificRemindHours || 5;
          const remindDays =
            notificationData.businessUnitId.notificRemindDays || 5;
          const firstNotificAt = moment(activeFrom)
            .add(remindDays, 'days')
            .format();
          const lastNotified =
            moment(notificationData.lastNotified).format() || activeFrom;
          const nextNotified = moment(lastNotified)
            .add(remindHours, 'hours')
            .format();

          /* 1. If 1st Notification Reminder Period Passed
          2. If next estimated reminder time passed */
          if (
            moment().isAfter(firstNotificAt) &&
            moment().isAfter(nextNotified)
          ) {
            // Update Last Updated Time
            await Notification.findOneAndUpdate(
              {
                _id: notificationId,
              },
              {
                $set: {
                  lastNotified: moment().utc().format(),
                },
              },
            );

            /** Push to unread user in a single call */
            const userTokens = [];

            for (const userData of notificationData.notifyUnreadUsers) {
              userTokens.push(userData.deviceToken);
            }
            const pushData = {
              title: notificationData.title,
              body: notificationData.subTitle,
              redirect: 'notifications',
            };
            const collapseKey = notificationData._id;

            if (userTokens.length > 0) {
              FCM.push(userTokens, pushData, collapseKey);
            }

            /** Mail to unread user */
            for (const userData of notificationData.notifyUnreadUsers) {
              const mailData = {
                notificationData,
                userData,
                companyData,
              };

              mailer.notificReminder(mailData);
            }
          }
        } // notification iteration
      } // company iteration
    } catch (err) {
      __.log(err);
    }
  }

  // In complete Task notification - In last 3 Hours
  async taskNotification() {
    // Get Active Walls
    const wallList = await Wall.find({
      status: 1,
    }).lean();

    const wallIds = wallList.map((v) => v._id);

    // Get Active Category
    let categoryIds = await WallCategory.find({
      wallId: {
        $in: wallIds,
      },
      status: 1,
    });

    categoryIds = categoryIds.map((v) => v._id);

    // If no active categorys , then stop execution
    if (categoryIds.length === 0) {
      return true;
    }

    const postList = await WallPost.find({
      category: {
        $in: categoryIds,
      },
      taskDueDate: {
        $gte: moment().add(3, 'hours').utc(),
      },
      taskList: {
        $gt: [],
      },
      isTaskCompleted: false,
      isTaskNotified: false,
      status: 1,
    })
      .populate({
        path: 'assignedToList',
        select: 'name deviceToken',
      })
      .lean();

    for (const elem of postList) {
      const usersDeviceTokens = await Array.from(
        elem.assignedToList,
        (x) => x.deviceToken,
      );

      if (usersDeviceTokens.length > 0) {
        await WallPost.update(
          {
            _id: elem._id,
          },
          {
            $set: {
              isTaskNotified: true,
            },
          },
        );
        const pushData = {
          title: elem.title,
          body: elem.title,
          redirect: 'notifications',
        };
        const collapseKey = elem._id;

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      }
    }
    return true;
  }

  // Password Rechange Reminder - In last  10 days
  async passwordChangeNotification() {
    try {
      const companyList = await PageSettingModel.find({
        'pwdSettings.status': 1,
        'pwdSettings.pwdDuration': {
          $gt: 10,
        },
        status: 1,
      })
        .populate({
          path: 'companyId',
          select: 'name status',
          match: {
            status: 1,
          },
        })
        .select('pwdSettings')
        .lean();

      for (const companyData of companyList) {
        // Active Companies
        if (companyData.companyId == null) {
          continue;
        }

        // notifiedAt subtract
        const previousUpdated = moment()
          .subtract(companyData.pwdSettings.pwdDuration - 10, 'days')
          .utc()
          .format();
        const lastNotified = moment().subtract(1, 'days').utc().format();
        // Get all Notifications
        const matchQuery = {
          companyId: companyData.companyId._id,
          status: 1,
          'pwdManage.pwdUpdatedAt': {
            $lt: previousUpdated,
          },
          'pwdManage.notifiedAt': {
            $lt: lastNotified,
          },
        };
        const userList = await User.find(matchQuery)
          .select('staffId email deviceToken')
          .lean();

        const usersDeviceTokens = userList
          .map((v) => v.deviceToken)
          .filter(Boolean);

        const userIds = userList.map((v) => v._id).filter(Boolean);

        // update the user to last notified
        await User.update(
          {
            _id: {
              $in: userIds,
            },
          },
          {
            'pwdManage.notifiedAt': moment().utc().format(),
          },
        );

        const pushData = {
          title: `Password Notification`,
          body: `Password Notification`,
          redirect: 'notifications',
        };
        const collapseKey = companyData.companyId._id;

        FCM.push(usersDeviceTokens, pushData, collapseKey);
      } // company iteration
      __.log('password reminder called');
    } catch (err) {
      __.log(err);
    }
  }

  // Password Rechange Reminder - on daily basis from 7 days before.
  async passwordChangeNotificationRemainder() {
    try {
      const companyList = await PageSettingModel.find({
        'pwdSettings.status': 1,
        'pwdSettings.pwdDuration': {
          $gt: 7,
        },
        status: 1,
      })
        .populate({
          path: 'companyId',
          select: 'name status',
          match: {
            status: 1,
          },
        })
        .select('pwdSettings')
        .lean();

      for (const companyData of companyList) {
        // Active Companies
        if (companyData.companyId == null) {
          continue;
        }

        const previousUpdated = moment()
          .subtract(+companyData.pwdSettings.pwdDuration - 7, 'days')
          .utc()
          .format();
        const expireDate = moment()
          .subtract(+companyData.pwdSettings.pwdDuration, 'days')
          .utc()
          .format();
        // let lastNotified = moment().subtract(1, "days").utc().format();
        // Get all Notifications
        const matchQuery = {
          companyId: companyData.companyId._id,
          status: 1,
          'pwdManage.pwdUpdatedAt': {
            $lt: previousUpdated,
            $gt: expireDate,
          },
          // $or: [
          //     { "pwdManage.notifiedAt": { $exists:false } },
          //     { "pwdManage.notifiedAt": {
          //         $lt: lastNotified
          //     }}
          // ]
        };
        const userList = await User.find(matchQuery)
          .select('staffId email deviceToken pwdManage')
          .lean();

        const usersDeviceTokens = userList
          .map((v) => v.deviceToken)
          .filter(Boolean);
        const staffDetailswithDeviceToken = userList
          .map((v) => ({
            staffId: v.staffId,
            deviceToken: v.deviceToken,
          }))
          .filter((v) => v.deviceToken);

        // let userIds = userList.map(v => {
        //     return v._id;
        // }).filter(Boolean);

        // update the user to last notified
        // await User.update({
        //     _id: {
        //         $in: userIds
        //     }
        // }, {
        //     "pwdManage.notifiedAt": moment().utc().format()
        // });

        if (usersDeviceTokens.length) {
          const pushData = {
            title: `Password-Notification`,
            body: `You are requested to change your account password`,
            redirect: 'notifications',
          };
          const collapseKey = `${Math.random() * 10000000}`;

          FCM.push(
            usersDeviceTokens,
            pushData,
            collapseKey,
            staffDetailswithDeviceToken,
          );
        }
      } // company iteration
      // __.log('password reminder called');
    } catch (err) {
      __.log(err);
    }
  }

  async sftpIntegraionAt04() {
    // retry logic starts
    const currentFolder = './public/';
    const files = await fs.readdirSync(currentFolder);

    const today = moment().add(1, 'days').format('YYYYMMDD');
    const currentDate = `${today}07`;
    const myFiles = files.filter(
      (v) => v.indexOf(currentDate) !== -1 && v.includes('.csv'),
    );

    if (myFiles.length) {
      // Hariharan
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'SFTP Integration 04 file already exists. retry cancel.',
          date: new Date(),
        }),
      );
      return;
    }

    // Hariharan
    await fs.appendFileSync(
      './public/integration/integration.log',
      JSON.stringify({
        message: 'SFTP Integration 04 file not exists. retry begins.',
        date: new Date(),
      }),
    );
    // retry logic ends

    const sftp = new Client();

    // const today = moment().add(1, 'days').format('YYYYMMDD');
    // let timeStamp = `${today}07`;
    await sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'MySATS_AD_PRD',
        password: 'mySatsprd!23',
        readyTimeout: 40000, // timeout increased to 40 seconds, previously its 20 seconds
        algorithms: {
          kex: ['diffie-hellman-group14-sha1'],
        },
      })
      .then(() => sftp.list('/ADDailyExtractPRD'))
      .then(async (data) => {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP Integration 04 starts',
            date: new Date(),
          }),
        );
        data = data || [];
        const filteredData = data.filter(
          (v) => v.name.indexOf(`dailyMySATS${currentDate}`) !== -1,
        );

        for (const d of filteredData) {
          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'SFTP Integration 04 log 1',
              date: new Date(),
            }),
          );
          const daily = d.name;

          await sftp.get(`/ADDailyExtractPRD/${daily}`).then(
            async (fileData) => {
              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 04 log 2',
                  date: new Date(),
                }),
              );
              await fs.writeFileSync(`public/${daily}`, fileData);

              await spawn('unzip', [
                '-P',
                'Daily@dm1n!',
                '-d',
                './public/',
                `./public/${daily}`,
              ]);

              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 04 ends',
                  date: new Date(),
                }),
              );
              // await integration(resDaily, req, res);
            },
            async (error) => {
              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 04 ends with error',
                  date: new Date(),
                  detail: `${error}`,
                }),
              );
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify(error),
              );
            },
          );
        }
      })
      .catch(async (error) => {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP Integration 04 error before starts',
            date: new Date(),
            detail: `${error}`,
          }),
        );
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify(error),
        );
      });
  }

  async sftpIntegraionAt13() {
    // retry logic starts
    const currentFolder = './public/';
    const files = await fs.readdirSync(currentFolder);

    const currentDate = `${moment().format('YYYYMMDD')}13`;
    const myFiles = files.filter(
      (v) => v.indexOf(currentDate) !== -1 && v.includes('.csv'),
    );

    if (myFiles.length) {
      // Hariharan
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'SFTP Integration 13 file already exists. retry cancel.',
          date: new Date(),
        }),
      );
      return;
    }

    // Hariharan
    await fs.appendFileSync(
      './public/integration/integration.log',
      JSON.stringify({
        message: 'SFTP Integration 13 file not exists. retry begins.',
        date: new Date(),
      }),
    );
    // retry logic ends

    const sftp = new Client();
    const timeStamp = `${moment().format('YYYYMMDD')}13`;

    await sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'MySATS_AD_PRD',
        password: 'mySatsprd!23',
        readyTimeout: 40000, // timeout increased to 40 seconds, previously its 20 seconds
        algorithms: {
          kex: ['diffie-hellman-group14-sha1'],
        },
      })
      .then(() => sftp.list('/ADDailyExtractPRD'))
      .then(async (data) => {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP Integration 13 starts',
            date: new Date(),
          }),
        );
        data = data || [];
        const filteredData = data.filter(
          (v) => v.name.indexOf(`dailyMySATS${timeStamp}`) !== -1,
        );

        for (const d of filteredData) {
          // Hariharan
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: 'SFTP Integration 13 log 1',
              date: new Date(),
            }),
          );
          const daily = d.name;

          await sftp.get(`/ADDailyExtractPRD/${daily}`).then(
            async (fileData) => {
              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 13 log 2',
                  date: new Date(),
                }),
              );
              await fs.writeFileSync(`public/${daily}`, fileData);

              await spawn('unzip', [
                '-P',
                'Daily@dm1n!',
                '-d',
                './public/',
                `./public/${daily}`,
              ]);
              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 13 ends',
                  date: new Date(),
                }),
              );
              // const resDaily = daily.split('.')[0] + '.csv';
              // await integration(resDaily, req, res);
            },
            async (error) => {
              // Hariharan
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: 'SFTP Integration 13 ends with error',
                  date: new Date(),
                  detail: `${error}`,
                }),
              );
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify(error),
              );
            },
          );
        }
      })
      .catch(async (error) => {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP Integration 13 error before starts',
            date: new Date(),
            detail: `${error}`,
          }),
        );
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify(error),
        );
      });
  }

  async integrateNow13(req, res) {
    const currentFolder = './public/';

    await fs.readdir(currentFolder, async (err, files) => {
      // Hariharan
      if (err) {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'Integration 13 error',
            date: new Date(),
            detail: `${err}`,
          }),
        );
      }

      // Hariharan
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'Integration 13 starts',
          date: new Date(),
        }),
      );
      const currentDate = `${moment().format('YYYYMMDD')}13`;
      const myFiles = files.filter(
        (v) => v.indexOf(currentDate) !== -1 && v.includes('.csv'),
      );

      if (myFiles.length) {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `Integration 13 file exists length : ${myFiles.length}`,
            date: new Date(),
          }),
        );
        for (const myFile of myFiles) {
          const resDaily = `${myFile.split('.')[0]}.csv`;

          await integration(resDaily, req, res);
        }
      } else {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'File Not found',
            date: new Date(),
          }),
        );
      }
    });
  }

  async integrateNow04(req, res) {
    const currentFolder = './public/';

    await fs.readdir(currentFolder, async (err, files) => {
      // Hariharan
      if (err) {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'Integration 04 error',
            date: new Date(),
            detail: `${err}`,
          }),
        );
      }

      // Hariharan
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'Integration 04 starts',
          date: new Date(),
        }),
      );
      const today = moment().add(1, 'days').format('YYYYMMDD');
      const currentDate = `${today}07`;
      // const currentDate = moment().format('YYYYMMDD') + '04';
      const myFiles = files.filter(
        (v) => v.indexOf(currentDate) !== -1 && v.includes('.csv'),
      );

      if (myFiles.length) {
        // Hariharan
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `Integration 04 file exists length : ${myFiles.length}`,
            date: new Date(),
          }),
        );
        for (const myFile of myFiles) {
          const resDaily = `${myFile.split('.')[0]}.csv`;

          await integration(resDaily, req, res);
        }
      } else {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'File Not found',
            date: new Date(),
          }),
        );
      }
    });
  }

  async integrateNow(req, res) {
    try {
      await integration('dailyMySATS20190924042020.csv', req, res);
    } catch (error) {
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: 'an error occurs',
          error: JSON.stringify(error),
          date: new Date(),
        }),
      );
    }
  }

  async updateLeaveQuota() {
    const sftp = new Client();
    const timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    // let timeStamp = `${moment().format('YYYYMMDD')}`;

    // let daily = '';
    const failedData = [];
    const successData = [];

    await sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'ftp_LBS_SF_MYSATS',
        password: 'YUyJ3JjcJG8uVT@@',
        readyTimeout: 720000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha1'],
        },
      })
      .then(() => sftp.list(`./O001/LBSQuota${timeStamp}.csv`))
      .then(async (data) => {
        data = data || [];
        const filteredData = data.filter(
          (v) => v.name.indexOf(`LBSQuota${timeStamp}.csv`) !== -1,
        );

        for (const d of filteredData) {
          const daily = d.name;

          await sftp.get(`./O001/${daily}`).then(
            async (fileData) => {
              await fs.writeFileSync(`./public/${daily}`, fileData);

              await spawn('unzip', [
                '-P',
                'Daily@dm1n!',
                '-d',
                './public/',
                `./O001/${daily}`,
              ]);
            },
            async (error) => {
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify(error),
              );
            },
          );

          const serverFile = `./public/${daily}`;
          const columns = ['StaffID', 'LeaveDataType', 'Year', 'Value'];

          // eslint-disable-next-line global-require
          require('csv-to-array')(
            {
              file: serverFile,
              columns,
            },
            async (err, userList) => {
              const companyData = await Company.findOne({
                pathName: 'sats',
              })
                .lean()
                .select('_id');

              const lt = ['CFAL_SGP', 'Annual Leave'];
              const leaveTypeDetails = await LeaveType.find({
                name: lt,
                companyId: companyData._id,
              }).select('_id name');
              const ltDetails = {
                'AL _SGP': leaveTypeDetails.find(
                  (leave) => leave.name === 'Annual Leave',
                )._id,
                CFAL_SGP: leaveTypeDetails.find(
                  (leave) => leave.name === 'CFAL_SGP',
                )._id,
              };

              const logData = {
                newUsers: [],
                status: 'Success',
                sourcePath: 'Quota',
                errorFilePath: null,
                updatedUsers: [],
                errorMessage: '',
                companyId: companyData._id,
              };

              if (err) {
                logData.status = 'File not found';
                logData.errorMessage = `File not found ${JSON.stringify(err)}`;
              }

              if (userList && userList.length !== 0) {
                userList.shift();
                const currentYear = moment().format('YYYY');
                const invalidDataList = [];
                const previousCurrentNextYear = [
                  parseInt(currentYear, 10) - 1,
                  parseInt(currentYear, 10),
                  parseInt(currentYear, 10) + 1,
                ];

                for (const user of userList) {
                  let userData = '';
                  const year = parseInt(user.Year, 10) || 0;

                  if (
                    user.LeaveDataType !== 'AL _SGP' &&
                    user.LeaveDataType !== 'CFAL_SGP'
                  ) {
                    user.Reason = 'LeaveDataType is not matching';
                    invalidDataList.push(user);
                  } else if (!previousCurrentNextYear.includes(year)) {
                    user.Reason =
                      'The year is neither Current, Previous nor Next year.';
                    invalidDataList.push(user);
                  } else if (parseInt(user.Value, 10) < 0) {
                    user.Reason = 'Levae value can not be negative';
                    invalidDataList.push(user);
                  } else {
                    userData = await User.findOne(
                      {
                        staffId: user.StaffID,
                      },
                      {
                        leaveGroupId: 1,
                      },
                    ).populate([
                      {
                        path: 'leaveGroupId',
                        match: {
                          isActive: true,
                        },
                        select: 'leaveType leaveTypeId',
                        populate: [
                          {
                            path: 'leaveType.leaveTypeId',
                            match: {
                              isActive: true,
                              _id: ltDetails['AL _SGP'],
                            },
                            select: 'name',
                          },
                        ],
                      },
                    ]);
                    if (
                      userData &&
                      userData.leaveGroupId &&
                      userData.leaveGroupId.leaveType
                    ) {
                      if (
                        userData.leaveGroupId.leaveType &&
                        userData.leaveGroupId.leaveType.length > 0
                      ) {
                        let leaveType = userData.leaveGroupId.leaveType.filter(
                          (leave) => leave && leave.leaveTypeId, // && leave.leaveTypeId.name == 'Annual Leave'
                        );

                        if (leaveType && leaveType.length > 0) {
                          const obj = {};

                          [leaveType] = leaveType;
                          obj.userId = userData._id;
                          obj.leaveGroupId = userData.leaveGroupId._id;
                          obj.leaveTypeId = ltDetails[user.LeaveDataType];
                          obj.quota = Number(user.Value);
                          obj.year = parseInt(user.Year, 10);
                          const staffLeaveData = await staffLeave.findOne({
                            userId: obj.userId,
                          });

                          let index = 0;

                          if (staffLeaveData) {
                            index = staffLeaveData.leaveDetails.findIndex(
                              (le) =>
                                le.leaveTypeId.toString() ===
                                  obj.leaveTypeId.toString() &&
                                le.year === obj.year,
                            );
                          }

                          let leaveDetails = {};

                          if (
                            index !== -1 &&
                            staffLeaveData &&
                            staffLeaveData.leaveDetails.length !== 0
                          ) {
                            leaveDetails = staffLeaveData.leaveDetails[index];
                            const inc = obj.quota - leaveDetails.total;

                            staffLeaveData.leaveDetails[index].total =
                              obj.quota;
                            staffLeaveData.leaveDetails[index].request += inc;
                            staffLeaveData.leaveDetails[index].taken += inc;
                            staffLeaveData.leaveDetails[
                              index
                            ].planDymanicQuota += inc;
                            staffLeaveData.leaveDetails[index].quota += inc;
                            staffLeaveData.leaveDetails[index].planQuota += inc;
                            await staffLeaveData.save();
                          } else {
                            leaveDetails = {
                              leaveTypeId: obj.leaveTypeId,
                              request: 0,
                              taken: 0,
                              total: obj.quota,
                              planDymanicQuota: obj.quota,
                              planQuota: obj.quota,
                              quota: obj.quota,
                              year: obj.year,
                            };

                            if (staffLeaveData && staffLeaveData.leaveDetails) {
                              const newArray =
                                staffLeaveData.leaveDetails.concat([
                                  leaveDetails,
                                ]);

                              staffLeaveData.leaveDetails = newArray;
                              await staffLeaveData.save();

                              user.Reason = '';
                              successData.push(obj);
                              user.Reason = '';
                              successData.push(obj);
                            } else {
                              user.Reason =
                                'Leave Group is not updated for this user in our DB';
                              invalidDataList.push(user);
                            }
                          }
                        } else {
                          user.message = 'Something went wrong';
                          invalidDataList.push(user);
                          failedData.push(user);
                        }
                      } else {
                        user.message = 'Leave Type not found';
                        failedData.push(user);
                      }
                    } else {
                      user.Reason = 'Staff ID is not matching with our DB';
                      if (userData && !userData.leaveGroupId) {
                        user.Reason =
                          'This user does not belong to any Leave Group';
                      }

                      invalidDataList.push(user);
                    }
                  }
                }
                if (invalidDataList.length !== 0) {
                  const updatedUsers = [];
                  const nonUpdatedUsers = [];

                  userList.forEach((user) => {
                    if (user.Reason) {
                      nonUpdatedUsers.push(user.Reason);
                    } else {
                      updatedUsers.push(user.StaffID);
                    }
                  });

                  const columnsI = [
                    'StaffID',
                    'LeaveDataType',
                    'Year',
                    'Value',
                    'Reason',
                  ];
                  const fileName = `NonUpdatedQuotaData${moment()
                    .add('days', 1)
                    .format('YYYYMMDD')}`;

                  logData.updatedUsers = updatedUsers;
                  logData.nonUpdatedUsers = nonUpdatedUsers;
                  logData.status = 'Partially completed';
                  logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                  logData.companyId = companyData._id;

                  const csvI = json2csv(invalidDataList, { fields: columnsI });

                  await fs.writeFile(
                    `./public/LBSQuota/${fileName}.csv`,
                    csvI,
                    (errI) => {
                      if (errI) {
                        __.log(`json2csv err${errI}`);
                      }
                    },
                  );

                  await new Integration(logData).save();
                } else {
                  const updatedUsers = [];
                  const nonUpdatedUsers = [];

                  userList.forEach((user) => {
                    if (user.Reason) {
                      nonUpdatedUsers.push(user.Reason);
                    } else {
                      updatedUsers.push(user.StaffID);
                    }
                  });
                  const columnsI = [
                    'StaffID',
                    'LeaveDataType',
                    'Year',
                    'Value',
                    'Reason',
                  ];
                  const fileName = `NonUpdatedQuotaData${moment()
                    .add('days', 1)
                    .format('YYYYMMDD')}`;

                  logData.updatedUsers = updatedUsers;
                  logData.nonUpdatedUsers = nonUpdatedUsers;
                  logData.status = 'Success';

                  const csvI = json2csv(invalidDataList, { fields: columnsI });

                  await fs.writeFile(
                    `./public/LBSQuota/${fileName}.csv`,
                    csvI,
                    (errI) => {
                      if (errI) {
                        __.log(`json2csv err${errI}`);
                      }
                    },
                  );
                  await new Integration(logData).save();
                  await fs.appendFileSync(
                    './public/integration/integration.log',
                    JSON.stringify(logData),
                  );
                }
              }
            },
          );
        }
      });
  }

  async uploadLBSPlanCSV() {
    try {
      const startDate = `${moment().format('YYYY-MM-DD')}T00:00:00.000Z`;
      const endDate = `${moment()
        .add('days', 28)
        .format('YYYY-MM-DD')}T00:00:00.0000Z`;
      const leaveList = await LeaveApplied.find({
        $and: [
          {
            startDate: {
              $gte: startDate,
            },
          },
          {
            startDate: {
              $lte: endDate,
            },
          },
          {
            flag: {
              $ne: true,
            },
          },
        ],
        $or: [
          {
            submittedFrom: {
              $in: [3, 4],
            },
          },
          {
            submittedFrom: 2,
            status: {
              $in: [1, 7, 8, 9],
            },
          },
        ],
      })
        .populate([
          {
            path: 'userId',
            select: 'staffId companyId',
          },
        ])
        .select('startDate endDate');

      if (leaveList && leaveList.length !== 0) {
        const prepareDataForCSV = [];

        for (const leave of leaveList) {
          if (
            leave &&
            leave.userId &&
            leave.userId.companyId.toString() === '5a9d162b36ab4f444b4271c8'
          ) {
            prepareDataForCSV.push({
              StaffID: leave.userId.staffId,
              MySATS_TxID: leave._id,
              LeaveStartDate: moment(leave.startDate).format('YYYYMMDD'),
              LeaveEndDate: moment(leave.endDate).format('YYYYMMDD'),
            });
          }
        }
        const columns = [
          'StaffID',
          'MySATS_TxID',
          'LeaveStartDate',
          'LeaveEndDate',
        ];

        const csvI = json2csv(prepareDataForCSV, { fields: columns });

        const fileName = `./I001/LBSPlan${moment()
          .add('days', 1)
          .format('YYYYMMDD')}.csv`;
        const sftp = new Client();

        await sftp
          .connect({
            host: 'ftp.sats.com.sg',
            port: '22',
            username: 'ftp_LBS_SF_MYSATS',
            password: 'YUyJ3JjcJG8uVT@@',
            readyTimeout: 180000,
            algorithms: {
              kex: ['diffie-hellman-group14-sha1'],
            },
          })

          .then(async () => {
            for (const leave of prepareDataForCSV) {
              await LeaveApplied.findOneAndUpdate(
                {
                  _id: leave.MySATS_TxID,
                },
                {
                  $set: {
                    flag: true,
                  },
                },
              );
            }
            return sftp.put(Buffer.from(csvI), fileName);
          })
          .then(async () =>
            //      await LeaveApplied.findOneAndUpdate({ _id: prepareDataForCSV.map(leave => leave.MySATS_TxID) },{ $set: { flag: true }});
            sftp.end(),
          )
          .catch(() => {});
      } else {
        const columns = [
          'StaffID',
          'MySATS_TxID',
          'LeaveStartDate',
          'LeaveEndDate',
        ];

        const csvI = json2csv([], { fields: columns });

        const fileName = `./I001/LBSPlan${moment()
          .add('days', 1)
          .format('YYYYMMDD')}.csv`;
        const sftp = new Client();

        await sftp
          .connect({
            host: 'ftp.sats.com.sg',
            port: '22',
            username: 'ftp_LBS_SF_MYSATS',
            password: 'YUyJ3JjcJG8uVT@@',
            algorithms: {
              kex: ['diffie-hellman-group14-sha1'],
            },
          })
          .then(() => sftp.put(Buffer.from(csvI), fileName))
          .then(async () => sftp.end())
          .catch(() => {});
      }
    } catch (error) {
      // empty block
    }
  }

  async sftpLBSApproveToUploadFileLocally() {
    const currentFolder = './public/approve/';
    const files = await fs.readdirSync(currentFolder);
    const fileName = `lbsApprove${moment()
      .add('days', 1)
      .format('YYYYMMDD')}.csv`;

    // const fileName = `lbsApprove${moment().format('YYYYMMDD')}.csv`;
    const myFiles = files.filter(
      (v) => v.indexOf(fileName) !== -1 && v.includes('.csv'),
    );

    // If file exist then return the function
    if (myFiles.length) {
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: `SFTP Approve file already exists. retry cancel for fileName: ${fileName}`,
          date: new Date(),
        }),
      );
      return;
    }

    // If file doesn't exist then try again
    await fs.appendFileSync(
      './public/integration/integration.log',
      JSON.stringify({
        message: `SFTP Approve file Start, fileName: ${fileName}`,
        date: new Date(),
      }),
    );

    const sftp = new Client();
    // let timeStamp = `${moment().format('YYYYMMDD')}`;
    const timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;

    await sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'ftp_LBS_SF_MYSATS',
        password: 'YUyJ3JjcJG8uVT@@',
        readyTimeout: 180000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha1'],
        },
      })
      .then(() => sftp.list(`O002/LBSApproved${timeStamp}.csv`))
      .then(async (data) => {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `SFTP LBSApprove starts, timeStamp: ${timeStamp}`,
            date: new Date(),
          }),
        );
        data = data || [];
        const filteredData = data.filter(
          (v) => v.name.indexOf(`LBSApproved${timeStamp}`) !== -1,
        );

        for (const d of filteredData) {
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: `SFTP LBSApprove log 1, timeStamp: ${timeStamp}`,
              date: new Date(),
            }),
          );
          const daily = d.name;

          await sftp.get(`./O002/${daily}`).then(
            async (fileData) => {
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSApprove log 2, timeStamp: ${timeStamp}`,
                  date: new Date(),
                }),
              );

              await spawn('unzip', [
                '-P',
                'Daily@dm1n!',
                '-d',
                './public/',
                `./public/${daily}`,
              ]);
              await fs.writeFileSync(
                `public/approve/lbsApprove${timeStamp}.csv`,
                fileData,
              );
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSApprove ends: timeStamp ${timeStamp}`,
                  date: new Date(),
                }),
              );
            },
            async (error) => {
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSApprove ends with error ${fileName}`,
                  date: new Date(),
                  detail: `${error}`,
                }),
              );
            },
          );
        }
      })
      .catch(async (error) => {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP LBSApprove error before starts',
            date: new Date(),
            detail: `${error}`,
          }),
        );
      });
  }

  async lbsApproveProccessCSV() {
    try {
      const timeStamp = moment().add('days', 1).format('YYYYMMDD');
      // const timeStamp = moment().format('YYYYMMDD');
      const serverFile = `./public/approve/lbsApprove${timeStamp}.csv`;

      const columns = [
        'StaffID',
        'SF_TxID',
        'AbsencesType',
        'AbsenceStartDate',
        'AbsenceStartTime',
        'AbsenceEndDate',
        'AbsenceDuration',
        'Status',
        'MySATS_TxID',
      ];

      const results = [];

      try {
        if (fs.existsSync(serverFile)) {
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: `LBSApprove file exist, timeStamp: ${timeStamp}`,
              date: new Date(),
            }),
          );
        } else {
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: `LBSApprove file does not exist, timeStamp: ${timeStamp}`,
              date: new Date(),
            }),
          );
          return;
        }
      } catch (error) {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `Caught an error in first catch block  timeStamp: ${timeStamp}, error: ${error}`,
            date: new Date(),
          }),
        );
      }

      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: `LBSApprove file reading start!, timeStamp: ${timeStamp}`,
          date: new Date(),
        }),
      );
      fs.createReadStream(serverFile)
        .pipe(csv(columns))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          // eslint-disable-next-line global-require
          require('csv-to-array')(
            {
              file: serverFile,
              columns,
            },
            async (err, userData) => {
              if (err) {
                return false;
              }

              const approvalUser = await User.findOne(
                {
                  staffId: {
                    $in: 'admin001',
                  },
                },
                {
                  staffId: 1,
                  name: 1,
                },
              );

              const companyData = await Company.findOne({
                pathName: 'sats',
              })
                .lean()
                .select('_id');

              const logData = {
                newUsers: [],
                status: 'Success',
                sourcePath: 'Approve',
                errorFilePath: null,
                updatedUsers: [],
                nonUpdatedUsers: [],
                errorMessage: '',
                companyId: companyData._id,
              };

              let userList = JSON.parse(JSON.stringify(userData));
              const dataToBeAdded = [];
              const invalidUserEntry = [];
              const createUserEntry = [];
              const updateUserEntry = [];

              if (userList && userList.length > 1) {
                // Removed Excel Headers
                userList = userList.splice(1, userList.length - 1);
                // Conver and get all the leave names
                const leaveTypesFromExcel = [
                  ...new Set(
                    userList.map((e) =>
                      e.AbsencesType === 'AALV'
                        ? 'Annual Leave'
                        : e.AbsencesType,
                    ),
                  ),
                ];
                // Get Leave IDs.
                const leaveTypeData = await LeaveType.find(
                  {
                    name: {
                      $in: leaveTypesFromExcel,
                    },
                    companyId: mongoose.Types.ObjectId(
                      '5a9d162b36ab4f444b4271c8',
                    ),
                  },
                  {
                    name: 1,
                  },
                );
                // Get all staffIds from Excel
                const staffIds = [...new Set(userList.map((e) => e.StaffID))];
                // Get records of user row by row from excel
                const userDataI = await User.find(
                  {
                    staffId: {
                      $in: staffIds,
                    },
                    companyId: mongoose.Types.ObjectId(
                      '5a9d162b36ab4f444b4271c8',
                    ),
                  },
                  {
                    staffId: 1,
                    parentBussinessUnitId: 1,
                    leaveGroupId: 1,
                  },
                );
                const SF_TxIDFromExcel = [
                  ...new Set(userList.map((e) => e.SF_TxID)),
                ];
                // Check SF_TxID present or not
                const checkForSF_TxIDInDb = await LeaveApplied.find(
                  {
                    SF_TxID: {
                      $in: SF_TxIDFromExcel,
                    },
                  },
                  {
                    SF_TxID: 1,
                  },
                );

                for (const user of userList) {
                  const startDate = moment(user.AbsenceStartDate, 'YYYYMMDD');
                  const endDate = moment(user.AbsenceEndDate, 'YYYYMMDD');

                  if (endDate.diff(startDate, 'days') < 0) {
                    user.Reason =
                      'Leave Start date is later than Leave End date';
                    invalidUserEntry.push(user);
                  } else {
                    user.status = user.status || user.Status;
                    const leaveTypeName =
                      user.AbsencesType === 'AALV'
                        ? 'Annual Leave'
                        : user.AbsencesType;
                    const foundUser = await User.findOne(
                      {
                        staffId: user.StaffID,
                        companyId: mongoose.Types.ObjectId(
                          '5a9d162b36ab4f444b4271c8',
                        ),
                      },
                      {
                        staffId: 1,
                        leaveGroupId: 1,
                      },
                    );

                    const csvStatus = user.status
                      ? user.status.toLowerCase()
                      : '';
                    let isSFTxIDExist = '';

                    if (csvStatus === 'cancelled') {
                      isSFTxIDExist = await LeaveApplied.findOne(
                        { SF_TxID: user.SF_TxID },
                        { SF_TxID: 1 },
                      );
                    }

                    if (
                      !foundUser ||
                      Object.keys(foundUser).length === 0 ||
                      leaveTypeData.length === 0
                    ) {
                      user.Reason = 'StaffID is not matching';
                      invalidUserEntry.push(user);
                    } else if (csvStatus === 'cancelled' && !isSFTxIDExist) {
                      // Skip if SF_TxID is not found in DB and status is cancelled

                      user.Reason =
                        'No previous leave record found for this cancelled leave.';
                      invalidUserEntry.push(user);
                    } else if (foundUser.staffId === user.StaffID) {
                      // Create new Record if MySATS_TxID And SF_TxID are not present in excel

                      if (
                        !user.MySATS_TxID &&
                        user.StaffID &&
                        !checkForSF_TxIDInDb.some(
                          (e) => e.SF_TxID === user.SF_TxID,
                        )
                      ) {
                        // Create new Record if MySATS_TxID And SF_TxID are not present in excel
                        // if (!checkForSF_TxIDInDb.some(e => e.SF_TxID === user.SF_TxID)) {
                        const checkUser = await staffLeave.findOne(
                          {
                            userId: mongoose.Types.ObjectId(foundUser._id),
                          },
                          {
                            _id: 1,
                          },
                        );

                        if (checkUser) {
                          const obj = {};

                          obj.SF_TxID = user.SF_TxID;
                          const leaveTypeId = leaveTypeData.find(
                            (e) => e.name === leaveTypeName,
                          );
                          const leaveIdd =
                            leaveTypeId && Object.keys(leaveTypeId).length
                              ? mongoose.Types.ObjectId(leaveTypeId._id)
                              : '';
                          const parsedYear = parseInt(
                            user.AbsenceStartDate.substr(0, 4),
                            10,
                          );
                          const quotaValue = parseFloat(user.AbsenceDuration);

                          obj.leaveTypeId =
                            leaveTypeId && Object.keys(leaveTypeId).length
                              ? leaveTypeId._id
                              : '';
                          obj.leaveGroupId = userDataI.find(
                            (e) => e.staffId === user.StaffID,
                          ).leaveGroupId;
                          obj.userId = userDataI.find(
                            (e) => e.staffId === user.StaffID,
                          )._id;
                          obj.startDate = moment(
                            `${user.AbsenceStartDate.substr(
                              0,
                              4,
                            )}-${user.AbsenceStartDate.substr(
                              4,
                              2,
                            )}-${user.AbsenceStartDate.substr(6, 2)}`,
                            'YYYY-MM-DD HH:mm:ss Z',
                          )
                            .utc()
                            .format();
                          obj.endDate = moment(
                            `${user.AbsenceEndDate.substr(
                              0,
                              4,
                            )}-${user.AbsenceEndDate.substr(
                              4,
                              2,
                            )}-${user.AbsenceEndDate.substr(6, 2)}`,
                            'YYYY-MM-DD HH:mm:ss Z',
                          )
                            .utc()
                            .format();

                          obj.AbsenceStartTime = user.AbsenceStartTime;
                          obj.totalDay = user.AbsenceDuration;
                          obj.totalDeducated = user.AbsenceDuration;
                          obj.timeZone = '+0530';
                          obj.submittedFrom = 1;
                          obj.businessUnitId = userDataI.find(
                            (e) => e.staffId === user.StaffID,
                          ).parentBussinessUnitId;
                          obj.status =
                            {
                              cancelled: 5,
                              approved: 1,
                            }[user.status.toLowerCase()] || 0;

                          if (user.status.toLowerCase() === 'cancelled') {
                            obj.cancelledBy = mongoose.Types.ObjectId(
                              approvalUser._id,
                            );
                            obj.cancelledDateTime = moment().utc().format();
                          } else {
                            obj.approvalHistory = [
                              {
                                approvalBy: mongoose.Types.ObjectId(
                                  approvalUser._id,
                                ),
                                status: 1,
                                approvalFrom: 1,
                                approvalRemark: 'System Approved',
                                approvalDateTime: moment().utc().format(),
                                name: approvalUser.name,
                              },
                            ];
                          }

                          if (
                            leaveTypeData.find((e) => e.name === leaveTypeName)
                          ) {
                            try {
                              await staffLeave.update(
                                {
                                  userId: mongoose.Types.ObjectId(
                                    foundUser._id,
                                  ),
                                  leaveDetails: {
                                    $elemMatch: {
                                      leaveTypeId: leaveIdd,
                                      year: parsedYear,
                                    },
                                  },
                                },
                                {
                                  $inc: {
                                    'leaveDetails.$.planQuota': -quotaValue,
                                    'leaveDetails.$.quota': -quotaValue,
                                  },
                                },
                                {
                                  safe: true,
                                  upsert: true,
                                },
                              );
                              dataToBeAdded.push(obj);
                              createUserEntry.push(user);
                            } catch (error) {
                              user.Reason =
                                'This Leave type is not present for this year for this user.';
                              invalidUserEntry.push(user);
                            }
                          } else {
                            user.Reason =
                              'Leave group not assigned to this user';
                            invalidUserEntry.push(user);
                          }
                        } else {
                          user.Reason = 'Leave group not assigned to this user';
                          invalidUserEntry.push(user);
                        }
                      } else if (
                        checkForSF_TxIDInDb.length &&
                        !checkForSF_TxIDInDb.some(
                          (e) => e.SF_TxID === user.SF_TxID,
                        ) &&
                        user.status.toLowerCase() === 'cancelled'
                      ) {
                        user.Reason =
                          'This leave record is not present in our DB for this user';
                        invalidUserEntry.push(user);
                      } else {
                        const userDetail = await User.findOne({
                          staffId: user.StaffID,
                        });

                        if (userDetail && userDetail.leaveGroupId) {
                          let cancelledBy;
                          let approvalHistory = [];
                          const cancelledDateTime = moment().utc().format();

                          if (user.status.toLowerCase() === 'cancelled') {
                            cancelledBy = mongoose.Types.ObjectId(
                              approvalUser._id,
                            );
                          } else {
                            approvalHistory = [
                              {
                                approvalBy: mongoose.Types.ObjectId(
                                  approvalUser._id,
                                ),
                                status: 1,
                                approvalFrom: 1,
                                approvalRemark: 'System Approved',
                                approvalDateTime: moment().utc().format(),
                                name: approvalUser.name,
                              },
                            ];
                          }

                          const status =
                            user.status.toLowerCase() === 'approved' ? 1 : 5;
                          const startDateI = `${moment(
                            user.AbsenceStartDate,
                          ).format('YYYY-MM-DD')}T00:00:00.000Z`;
                          const endDateI = `${moment(
                            user.AbsenceEndDate,
                          ).format('YYYY-MM-DD')}T00:00:00.000Z`;
                          const leaveTypeId = leaveTypeData.find(
                            (e) => e.name === leaveTypeName,
                          );
                          const leaveIdd =
                            leaveTypeId && Object.keys(leaveTypeId).length
                              ? mongoose.Types.ObjectId(leaveTypeId._id)
                              : '';
                          const parsedYear = parseInt(
                            user.AbsenceStartDate.substr(0, 4),
                            10,
                          );
                          let quotaValue = parseFloat(user.AbsenceDuration);
                          const checkUser = await staffLeave.findOne(
                            {
                              userId: mongoose.Types.ObjectId(foundUser._id),
                            },
                            {
                              _id: 1,
                            },
                          );

                          if (checkUser) {
                            if (
                              leaveTypeData.find(
                                (e) => e.name === leaveTypeName,
                              )
                            ) {
                              // Update for Approved
                              if (approvalHistory.length) {
                                let checkForMySATS_TxID;

                                // Check if MySATS_TxID is presendt in Excel
                                if (user.MySATS_TxID.length) {
                                  await LeaveApplied.update(
                                    {
                                      _id: mongoose.Types.ObjectId(
                                        user.MySATS_TxID,
                                      ),
                                    },
                                    {
                                      $set: {
                                        status,
                                        SF_TxID: user.SF_TxID,
                                        submittedFrom: 1,
                                        approvalHistory,
                                        startDate: startDateI,
                                        endDate: endDateI,
                                        totalDay: user.AbsenceDuration,
                                        totalDeducated: user.AbsenceDuration,
                                      },
                                    },
                                    {
                                      new: true,
                                    },
                                  );
                                  try {
                                    await staffLeave.update(
                                      {
                                        userId: mongoose.Types.ObjectId(
                                          foundUser._id,
                                        ),
                                        leaveDetails: {
                                          $elemMatch: {
                                            leaveTypeId: leaveIdd,
                                            year: parsedYear,
                                          },
                                        },
                                      },
                                      {
                                        $inc: {
                                          'leaveDetails.$.planQuota':
                                            -quotaValue,
                                          'leaveDetails.$.quota': -quotaValue,
                                        },
                                      },
                                      {
                                        safe: true,
                                        upsert: true,
                                      },
                                    );
                                  } catch (error) {
                                    user.Reason =
                                      'This Leave type is not present for this year for this user.';
                                    invalidUserEntry.push(user);
                                  }
                                } else {
                                  // Check if SF_TxID present in DB for Approved
                                  checkForMySATS_TxID = await LeaveApplied.find(
                                    {
                                      SF_TxID: user.SF_TxID,
                                    },
                                    {
                                      _id: 1,
                                      startDate: 1,
                                      endDate: 1,
                                    },
                                  );

                                  if (checkForMySATS_TxID) {
                                    // Database leave startDate and endDate
                                    const leave = checkForMySATS_TxID[0];
                                    const start = moment(leave.startDate);
                                    const end = moment(leave.endDate);
                                    // Difference between startDate and endDate
                                    const dif = end.diff(start, 'days') + 1;

                                    // If difference between database duration and csv duration or not same then will calculate quotaValue else quotaValue will be 0
                                    if (dif !== user.AbsenceDuration) {
                                      if (dif < user.AbsenceDuration) {
                                        quotaValue = user.AbsenceDuration - dif;
                                      } else {
                                        quotaValue = dif - user.AbsenceDuration;
                                        quotaValue = -quotaValue;
                                      }
                                    } else {
                                      quotaValue = 0;
                                    }

                                    await LeaveApplied.update(
                                      {
                                        SF_TxID: user.SF_TxID,
                                      },
                                      {
                                        $set: {
                                          status,
                                          SF_TxID: user.SF_TxID,
                                          submittedFrom: 1,
                                          approvalHistory,
                                          startDate: startDateI,
                                          endDate: endDateI,
                                          totalDay: user.AbsenceDuration,
                                          totalDeducated: user.AbsenceDuration,
                                        },
                                      },
                                      {
                                        new: true,
                                      },
                                    );
                                    try {
                                      await staffLeave.update(
                                        {
                                          userId: mongoose.Types.ObjectId(
                                            foundUser._id,
                                          ),
                                          leaveDetails: {
                                            $elemMatch: {
                                              leaveTypeId: leaveIdd,
                                              year: parsedYear,
                                            },
                                          },
                                        },
                                        {
                                          $inc: {
                                            'leaveDetails.$.planQuota':
                                              -quotaValue,
                                            'leaveDetails.$.quota': -quotaValue,
                                          },
                                        },
                                        {
                                          safe: true,
                                          upsert: true,
                                        },
                                      );

                                      updateUserEntry.push(user);
                                    } catch (error) {
                                      user.Reason =
                                        'This Leave type is not present for this year for this user.';
                                      invalidUserEntry.push(user);
                                    }
                                  } else {
                                    user.Reason =
                                      'SF_TxID is not present so ignoring for Approved';
                                    invalidUserEntry.push(user);
                                  }
                                }
                              } else {
                                // Update for Cancelled
                                let checkForMySATS_TxID;

                                if (user.MySATS_TxID.length) {
                                  await LeaveApplied.update(
                                    {
                                      _id: mongoose.Types.ObjectId(
                                        user.MySATS_TxID,
                                      ),
                                    },
                                    {
                                      $set: {
                                        status,
                                        SF_TxID: user.SF_TxID,
                                        submittedFrom: 1,
                                        cancelledBy,
                                        cancelledDateTime,
                                        startDate: startDateI,
                                        endDate: endDateI,
                                        totalDay: user.AbsenceDuration,
                                        totalDeducated: user.AbsenceDuration,
                                      },
                                    },
                                    {
                                      new: true,
                                    },
                                  );
                                  try {
                                    await staffLeave.update(
                                      {
                                        userId: mongoose.Types.ObjectId(
                                          foundUser._id,
                                        ),
                                        leaveDetails: {
                                          $elemMatch: {
                                            leaveTypeId: leaveIdd,
                                            year: parsedYear,
                                          },
                                        },
                                      },
                                      {
                                        $inc: {
                                          'leaveDetails.$.planQuota':
                                            quotaValue,
                                          'leaveDetails.$.quota': quotaValue,
                                        },
                                      },
                                      {
                                        safe: true,
                                        upsert: true,
                                      },
                                    );
                                  } catch (error) {
                                    user.Reason =
                                      'This Leave type is not present for this year for this user.';
                                    invalidUserEntry.push(user);
                                  }
                                } else {
                                  // Check SF_TxID in DB for cancelled
                                  checkForMySATS_TxID = await LeaveApplied(
                                    {
                                      SF_TxID: user.SF_TxID,
                                    },
                                    {
                                      _id: 1,
                                    },
                                  );
                                  if (checkForMySATS_TxID) {
                                    await LeaveApplied.update(
                                      {
                                        SF_TxID: user.SF_TxID,
                                      },
                                      {
                                        $set: {
                                          status,
                                          SF_TxID: user.SF_TxID,
                                          submittedFrom: 1,
                                          cancelledBy,
                                          cancelledDateTime,
                                          startDate: startDateI,
                                          endDate: endDateI,
                                          totalDay: user.AbsenceDuration,
                                          totalDeducated: user.AbsenceDuration,
                                        },
                                      },
                                      {
                                        new: true,
                                      },
                                    );
                                    try {
                                      await staffLeave.update(
                                        {
                                          userId: mongoose.Types.ObjectId(
                                            foundUser._id,
                                          ),
                                          leaveDetails: {
                                            $elemMatch: {
                                              leaveTypeId: leaveIdd,
                                              year: parsedYear,
                                            },
                                          },
                                        },
                                        {
                                          $inc: {
                                            'leaveDetails.$.planQuota':
                                              quotaValue,
                                            'leaveDetails.$.quota': quotaValue,
                                          },
                                        },
                                        {
                                          safe: true,
                                          upsert: true,
                                        },
                                      );
                                      updateUserEntry.push(user);
                                    } catch (error) {
                                      user.Reason =
                                        'This Leave type is not present for this year for this user.';
                                      invalidUserEntry.push(user);
                                    }
                                  } else {
                                    user.Reason =
                                      'SF_TxID is not present so ignoring for cancelled.';
                                    invalidUserEntry.push(user);
                                  }
                                }
                              }
                            } else {
                              user.Reason = 'This Leave Type is not present';
                              invalidUserEntry.push(user);
                            }
                          } else {
                            user.Reason = 'This leave Type is not present';
                            invalidUserEntry.push(user);
                          }
                        } else {
                          user.Reason =
                            'Leave group not assigned to this user.';
                          invalidUserEntry.push(user);
                        }
                      }
                    } else {
                      user.Reason = 'StaffId not found';
                      invalidUserEntry.push(user);
                    }
                  }
                }
              }

              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `LBSApprove file reading End!, timeStamp: ${timeStamp}`,
                  date: new Date(),
                }),
              );

              await LeaveApplied.insertMany(dataToBeAdded);
              const columnsI = [
                'StaffID',
                'SF_TxID',
                'AbsencesType',
                'AbsenceStartDate',
                'AbsenceStartTime',
                'AbsenceEndDate',
                'AbsenceDuration',
                'Status',
                'MySATS_TxID',
                'Reason',
              ];
              const createdUser = [];
              const updatedUser = [];
              const failedUser = [];

              createUserEntry.forEach((user) => {
                updatedUser.push(user.StaffID);
              });
              updateUserEntry.forEach((user) => {
                updatedUser.push(user.StaffID);
              });
              invalidUserEntry.forEach((user) => {
                failedUser.push(user.Reason);
              });

              // const fileName = `NonUpdatedApprovedData${moment().format('YYYYMMDD')}`;
              const fileName = `NonUpdatedApprovedData${moment()
                .add('days', 1)
                .format('YYYYMMDD')}`;

              if (invalidUserEntry.length !== 0) {
                logData.updatedUsers = updatedUser;
                logData.nonUpdatedUsers = failedUser;
                logData.status = 'Partially completed';
                logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                logData.noOfNewUsers = createdUser;
                const csvI = json2csv({
                  data: invalidUserEntry,
                  fields: columnsI,
                });

                await fs.writeFile(
                  `./public/LBSQuota/${fileName}.csv`,
                  csvI,
                  (errI) => {
                    if (errI) {
                      __.log(`json2csv err${errI}`);
                    }
                  },
                );

                await new Integration(logData).save();
              } else {
                logData.failedUpdateUsers = failedUser;
                logData.updatedUsers = updatedUser;
                logData.nonUpdatedUsers = invalidUserEntry;
                logData.status = 'SUCCESS';
                logData.noOfNewUsers = createdUser;
                logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                const csvI = json2csv({
                  data: [],
                  fields: [],
                });

                await fs.writeFile(
                  `./public/LBSQuota/${fileName}.csv`,
                  csvI,
                  (errI) => {
                    if (errI) {
                      __.log(`json2csv err${errI}`);
                    }
                  },
                );
                await fs.appendFileSync(
                  './public/integration/integration.log',
                  JSON.stringify(logData),
                );
                await new Integration(logData).save();
              }

              return true;
            },
          );
        });
    } catch (error) {
      __.log(error);
    }
  }

  async sftpLBSQuotaToUploadFileLocally() {
    const currentFolder = './public/quota/';
    const files = await fs.readdirSync(currentFolder);
    const fileName = `lbsQuota${moment()
      .add('days', 1)
      .format('YYYYMMDD')}.csv`;

    // const fileName = `LBSQuota${moment().format('YYYYMMDD')}.csv`;
    const myFiles = files.filter(
      (v) => v.indexOf(fileName) !== -1 && v.includes('.csv'),
    );

    // If file exist then return the function
    if (myFiles.length) {
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: `SFTP Quota file already exists. retry cancel for fileName: ${fileName}`,
          date: new Date(),
        }),
      );
      return;
    }

    // If file doesn't exist then try again
    await fs.appendFileSync(
      './public/integration/integration.log',
      JSON.stringify({
        message: `SFTP Quota file Start, fileName: ${fileName}`,
        date: new Date(),
      }),
    );

    const sftp = new Client();
    // let timeStamp = `${moment().format('YYYYMMDD')}`;
    const timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;

    await sftp
      .connect({
        host: 'ftp.sats.com.sg',
        port: '22',
        username: 'ftp_LBS_SF_MYSATS',
        password: 'YUyJ3JjcJG8uVT@@',
        readyTimeout: 720000,
        algorithms: {
          kex: ['diffie-hellman-group14-sha1'],
        },
      })
      .then(() => sftp.list(`O001/LBSQuota${timeStamp}.csv`))
      .then(async (data) => {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `SFTP LBSQuota starts, timeStamp: ${timeStamp}`,
            date: new Date(),
          }),
        );
        data = data || [];
        const filteredData = data.filter(
          (v) => v.name.indexOf(`LBSQuota${timeStamp}`) !== -1,
        );

        for (const d of filteredData) {
          await fs.appendFileSync(
            './public/integration/integration.log',
            JSON.stringify({
              message: `SFTP LBSQuota log 1, timeStamp: ${timeStamp}`,
              date: new Date(),
            }),
          );
          const daily = d.name;

          await sftp.get(`./O001/${daily}`).then(
            async (fileData) => {
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSQuota log 2, timeStamp: ${timeStamp}`,
                  date: new Date(),
                }),
              );

              await spawn('unzip', [
                '-P',
                'Daily@dm1n!',
                '-d',
                './public/',
                `./public/${daily}`,
              ]);
              await fs.writeFileSync(
                `public/quota/LBSQuota${timeStamp}.csv`,
                fileData,
              );

              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSQuota ends: timeStamp ${timeStamp}`,
                  date: new Date(),
                }),
              );
            },
            async (error) => {
              await fs.appendFileSync(
                './public/integration/integration.log',
                JSON.stringify({
                  message: `SFTP LBSQuota ends with error ${fileName}`,
                  date: new Date(),
                  detail: `${error}`,
                }),
              );
            },
          );
        }
      })
      .catch(async (error) => {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: 'SFTP LBSQuota error before starts',
            date: new Date(),
            detail: `${error}`,
          }),
        );
      });
  }

  async lbsQuotaProccessCSV() {
    const timeStamp = `${moment().add('days', 1).format('YYYYMMDD')}`;
    // let timeStamp = `${moment().format('YYYYMMDD')}`;
    const serverFile = `./public/quota/LBSQuota${timeStamp}.csv`;
    const columns = ['StaffID', 'LeaveDataType', 'Year', 'Value'];

    const failedData = [];
    const successData = [];
    const results = [];

    try {
      if (fs.existsSync(serverFile)) {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `LBSQuota file exist, timeStamp: ${timeStamp}`,
            date: new Date(),
          }),
        );
      } else {
        await fs.appendFileSync(
          './public/integration/integration.log',
          JSON.stringify({
            message: `LBSQuota file does not exist, timeStamp: ${timeStamp}`,
            date: new Date(),
          }),
        );
        return;
      }
    } catch (error) {
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: `Caught an error in first catch block  timeStamp: ${timeStamp}, error: ${error}`,
          date: new Date(),
        }),
      );
    }
    try {
      await fs.appendFileSync(
        './public/integration/integration.log',
        JSON.stringify({
          message: `LBSQuota file reading start!, timeStamp: ${timeStamp}`,
          date: new Date(),
        }),
      );
      // data = data || [];
      // const filteredData = data.filter(v => -1 !== v.name.indexOf(`LBSQuota${timeStamp}.csv`));

      fs.createReadStream(serverFile)
        .pipe(csv(columns))
        .on('data', (data) => results.push(data))

        .on('end', async () => {
          // eslint-disable-next-line global-require
          require('csv-to-array')(
            {
              file: serverFile,
              columns,
            },
            async (err) => {
              const companyData = await Company.findOne({
                pathName: 'sats',
              })
                .lean()
                .select('_id');

              const lt = ['CFAL_SGP', 'Annual Leave'];
              const leaveTypeDetails = await LeaveType.find({
                name: lt,
                companyId: companyData._id,
              }).select('_id name');
              const ltDetails = {
                'AL _SGP': leaveTypeDetails.find(
                  (leave) => leave.name === 'Annual Leave',
                )._id,
                CFAL_SGP: leaveTypeDetails.find(
                  (leave) => leave.name === 'CFAL_SGP',
                )._id,
              };

              const logData = {
                newUsers: [],
                status: 'Success',
                sourcePath: 'Quota',
                errorFilePath: null,
                updatedUsers: [],
                errorMessage: '',
                companyId: companyData._id,
              };

              const userList = results;

              if (err) {
                logData.status = 'File not found';
                logData.errorMessage = `File not found ${JSON.stringify(err)}`;
              }

              if (userList && userList.length !== 0) {
                userList.shift();
                const currentYear = moment().format('YYYY');
                const invalidDataList = [];
                const previousCurrentNextYear = [
                  parseInt(currentYear, 10) - 1,
                  parseInt(currentYear, 10),
                  parseInt(currentYear, 10) + 1,
                ];

                for (const user of userList) {
                  let userData = '';
                  const year = parseInt(user.Year, 10) || 0;

                  if (
                    user.LeaveDataType !== 'AL _SGP' &&
                    user.LeaveDataType !== 'CFAL_SGP'
                  ) {
                    user.Reason = 'LeaveDataType is not matching';
                    invalidDataList.push(user);
                  } else if (!previousCurrentNextYear.includes(year)) {
                    user.Reason =
                      'The year is neither Current, Previous nor Next year.';
                    invalidDataList.push(user);
                  } else if (parseInt(user.Value, 10) < 0) {
                    user.Reason = 'Levae value can not be negative';
                    invalidDataList.push(user);
                  } else {
                    userData = await User.findOne(
                      {
                        staffId: user.StaffID,
                      },
                      {
                        leaveGroupId: 1,
                      },
                    ).populate([
                      {
                        path: 'leaveGroupId',
                        match: {
                          isActive: true,
                        },
                        select: 'leaveType leaveTypeId',
                        populate: [
                          {
                            path: 'leaveType leaveTypeId',
                            match: {
                              isActive: true,
                              name: user['Leave Type'],
                            },
                            select: 'name',
                          },
                        ],
                      },
                    ]);
                    if (
                      userData &&
                      userData.leaveGroupId &&
                      userData.leaveGroupId.leaveType
                    ) {
                      if (
                        userData.leaveGroupId.leaveType &&
                        userData.leaveGroupId.leaveType.length > 0
                      ) {
                        let leaveType = userData.leaveGroupId.leaveType.filter(
                          (leave) => leave && leave.leaveTypeId, // && leave.leaveTypeId.name == 'Annual Leave'
                        );

                        if (leaveType && leaveType.length > 0) {
                          const obj = {};

                          [leaveType] = leaveType;
                          obj.userId = userData._id;
                          obj.leaveGroupId = userData.leaveGroupId._id;
                          obj.leaveTypeId = ltDetails[user.LeaveDataType];
                          obj.quota = Number(user.Value);
                          obj.year = parseInt(user.Year, 10);
                          const staffLeaveData = await staffLeave.findOne({
                            userId: obj.userId,
                          });

                          let index = 0;

                          if (staffLeaveData) {
                            index = staffLeaveData.leaveDetails.findIndex(
                              (le) =>
                                le.leaveTypeId.toString() ===
                                  obj.leaveTypeId.toString() &&
                                le.year === obj.year,
                            );
                          }

                          let leaveDetails = {};

                          if (
                            index !== -1 &&
                            staffLeaveData &&
                            staffLeaveData.leaveDetails.length !== 0
                          ) {
                            leaveDetails = staffLeaveData.leaveDetails[index];
                            const inc = obj.quota - leaveDetails.total;

                            staffLeaveData.leaveDetails[index].total =
                              obj.quota;
                            staffLeaveData.leaveDetails[index].request += inc;
                            staffLeaveData.leaveDetails[index].taken += inc;
                            staffLeaveData.leaveDetails[
                              index
                            ].planDymanicQuota += inc;
                            staffLeaveData.leaveDetails[index].quota += inc;
                            staffLeaveData.leaveDetails[index].planQuota += inc;
                            await staffLeaveData.save();
                          } else {
                            leaveDetails = {
                              leaveTypeId: obj.leaveTypeId,
                              request: 0,
                              taken: 0,
                              total: obj.quota,
                              planDymanicQuota: obj.quota,
                              planQuota: obj.quota,
                              quota: obj.quota,
                              year: obj.year,
                            };

                            if (staffLeaveData && staffLeaveData.leaveDetails) {
                              const newArray =
                                staffLeaveData.leaveDetails.concat([
                                  leaveDetails,
                                ]);

                              staffLeaveData.leaveDetails = newArray;
                              await staffLeaveData.save();

                              user.Reason = '';
                              successData.push(obj);
                              user.Reason = '';
                              successData.push(obj);
                            } else {
                              user.Reason =
                                'Leave Group is not updated for this user in our DB';
                              invalidDataList.push(user);
                            }
                          }
                        } else {
                          user.message = 'Something went wrong';
                          invalidDataList.push(user);
                          failedData.push(user);
                        }
                      } else {
                        user.message = 'Leave Type not found';
                        failedData.push(user);
                      }
                    } else {
                      user.Reason = 'Staff ID is not matching with our DB';
                      if (userData && !userData.leaveGroupId) {
                        user.Reason =
                          'This user does not belong to any Leave Group';
                      }

                      invalidDataList.push(user);
                    }
                  }
                }
                if (invalidDataList.length !== 0) {
                  const updatedUsers = [];
                  const nonUpdatedUsers = [];

                  userList.forEach((user) => {
                    if (user.Reason) {
                      nonUpdatedUsers.push(user.Reason);
                    } else {
                      updatedUsers.push(user.StaffID);
                    }
                  });
                  const columnsI = [
                    'StaffID',
                    'LeaveDataType',
                    'Year',
                    'Value',
                    'Reason',
                  ];
                  const fileName = `NonUpdatedQuotaData${moment()
                    .add('days', 1)
                    .format('YYYYMMDD')}`;

                  logData.updatedUsers = updatedUsers;
                  logData.nonUpdatedUsers = nonUpdatedUsers;
                  logData.status = 'Partially completed';
                  logData.errorFilePath = `/LBSQuota/${fileName}.csv`;
                  logData.companyId = companyData._id;

                  const csvI = json2csv({
                    data: invalidDataList,
                    fields: columnsI,
                  });

                  await fs.writeFile(
                    `./public/LBSQuota/${fileName}.csv`,
                    csvI,
                    (errI) => {
                      if (errI) {
                        __.log(`json2csv err${errI}`);
                      }
                    },
                  );

                  await new Integration(logData).save();
                } else {
                  const updatedUsers = [];
                  const nonUpdatedUsers = [];

                  userList.forEach((user) => {
                    if (user.Reason) {
                      nonUpdatedUsers.push(user.Reason);
                    } else {
                      updatedUsers.push(user.StaffID);
                    }
                  });
                  const columnsI = [
                    'StaffID',
                    'LeaveDataType',
                    'Year',
                    'Value',
                    'Reason',
                  ];
                  const fileName = `NonUpdatedQuotaData${moment()
                    .add('days', 1)
                    .format('YYYYMMDD')}`;

                  logData.updatedUsers = updatedUsers;
                  logData.nonUpdatedUsers = nonUpdatedUsers;
                  logData.status = 'Success';
                  const csvI = json2csv({
                    data: invalidDataList,
                    fields: columnsI,
                  });

                  await fs.writeFile(
                    `./public/LBSQuota/${fileName}.csv`,
                    csvI,
                    (errI) => {
                      if (errI) {
                        __.log(`json2csv err${errI}`);
                      } else {
                        // empty block
                      }
                    },
                  );
                  await new Integration(logData).save();
                  await fs.appendFileSync(
                    './public/integration/integration.log',
                    JSON.stringify(logData),
                  );
                }
              }
            },
          );
        });
    } catch (error) {
      __.log(error);
    }
  }
}
const cronObj = new cron();

// cronObj.sftpIntegraionAt04()
// cronObj.updateLeaveQuota();
// cronObj.sftpIntegraionAt13()
// cronObj.sftpIntegraionAt04();
// cronObj.integrateNow04();
// cronObj.integrateNow13()
// cronObj.lbsQuotaProccessCSV()
// cronObj.sftpLBSQuotaToUploadFileLocally()
// var rule = new schedule.RecurrenceRule();

// rule.minute = new schedule.Range(0, 59, 1);
// schedule.scheduleJob('00 */1 * * * *', cronObj.notification);
// schedule.scheduleJob('00 */1 * * * * ', cronObj.publishingPost);
// schedule.scheduleJob('00 */1 * * * * ', cronObj.challengeNotification);
// schedule.scheduleJob('00 */1 * * * * ', cronObj.notificationReminder);
// schedule.scheduleJob('00 */1 * * * * ', cronObj.taskNotification);
// schedule.scheduleJob('00 */1 * * * * ', cronObj.passwordChangeNotification);
// schedule.scheduleJob('00 */30 */10 * * * ', cronObj.userIntegrationweekly);

// schedule.scheduleJob('00 */5 * * * * ', cronObj.integrateNow);
// schedule.scheduleJob('30 * * * * * ', cronObj.downloadFiles);

// schedule.scheduleJob('00 30 5 */1 * * ', cronObj.sftpIntegraionAt13);
// // below are 4 retry statements
// schedule.scheduleJob('00 31 5 */1 * * ', cronObj.sftpIntegraionAt13);
// schedule.scheduleJob('00 32 5 */1 * * ', cronObj.sftpIntegraionAt13);
// schedule.scheduleJob('00 33 5 */1 * * ', cronObj.sftpIntegraionAt13);
// schedule.scheduleJob('00 34 5 */1 * * ', cronObj.sftpIntegraionAt13);

// schedule.scheduleJob('00 30 23 */1 * * ', cronObj.sftpIntegraionAt04);
// // below are 4 retry statements
// schedule.scheduleJob('00 31 23 */1 * * ', cronObj.sftpIntegraionAt04);
// schedule.scheduleJob('00 32 23 */1 * * ', cronObj.sftpIntegraionAt04);
// schedule.scheduleJob('00 33 23 */1 * * ', cronObj.sftpIntegraionAt04);
// schedule.scheduleJob('00 34 23 */1 * * ', cronObj.sftpIntegraionAt04);

// schedule.scheduleJob('00 40 23 */1 * * ', cronObj.integrateNow04);
// schedule.scheduleJob('00 40 5 */1 * * ', cronObj.integrateNow13);

// schedule.scheduleJob({
// hour: 1,
// minute: 1,
// second: 1
//  }, cronObj.passwordChangeNotificationRemainder); // 6:30 - IST, 9:00 - SGT

// Newly added Scheduler

// var utcTimeZone = new schedule.RecurrenceRule();
// utcTimeZone.tz = 'UTC';
// utcTimeZone.second = 0;
// utcTimeZone.minute = 15;
// utcTimeZone.hour = 18;

// schedule.scheduleJob(utcTimeZone, cronObj.uploadLBSPlanCSV)

// cronObj.integrateNow();
/* setTimeout(async () => {
  await cronObj.integrateNow();
}, 10000); */

// LBS Approve download file locally at '/public/approve/' path
// schedule.scheduleJob('00 30 19 */1 * *', cronObj.sftpLBSApproveToUploadFileLocally);
// schedule.scheduleJob('00 40 19 */1 * *', cronObj.sftpLBSApproveToUploadFileLocally);
// schedule.scheduleJob('00 50 19 */1 * *', cronObj.sftpLBSApproveToUploadFileLocally);

// LBS Approve proccess downloaded file locally at '/public/approve' path
// schedule.scheduleJob('00 00 20 */1 * *', cronObj.lbsApproveProccessCSV);
// cronObj.lbsApproveProccessCSV()
// cronObj.sftpLBSApproveToUploadFileLocally()

// schedule.scheduleJob('00 40 18 */1 * *', cronObj.updateLeaveQuota);

// LBS Quota download file locally at '/public/quota/' path
// schedule.scheduleJob('00 30 18 */1 * *', cronObj.sftpLBSQuotaToUploadFileLocally);
// schedule.scheduleJob('00 35 18 */1 * *', cronObj.sftpLBSQuotaToUploadFileLocally);

// LBS Quota - proccess the locally downloaded file to update the database
// schedule.scheduleJob('00 40 18 */1 * *', cronObj.lbsQuotaProccessCSV);

// commented for beta release
// if (process.env.pm_id === '0' || !process.env.pm_id) {
//   const agenda = new Agenda({
//     db: {
//       address: process.env.LIVE_DB_HOST,
//     },
//     defaultConcurrency: 10,
//     maxConcurrency: 10,
//     lockLimit: 0,
//     defaultLockLifetime: 10000,
//     lockLifetime: 5000,
//   });
//   const options = {
//     skipImmediate: true,
//     unique: true,
//   };

//   (async function () {
//     const everyOneMinuteCron = agenda.create('everyOneMinuteCron', {});

//     const sftpIntegraionAt13_1 = agenda.create('sftpIntegraionAt13_1', {});
//     // below are 4 retry statements to avoid any failure
//     const sftpIntegraionAt13_2 = agenda.create('sftpIntegraionAt13_2', {});
//     const sftpIntegraionAt13_3 = agenda.create('sftpIntegraionAt13_3', {});
//     const sftpIntegraionAt13_4 = agenda.create('sftpIntegraionAt13_4', {});
//     const sftpIntegraionAt13_5 = agenda.create('sftpIntegraionAt13_5', {});

//     const sftpIntegraionAt04_1 = agenda.create('sftpIntegraionAt04_1', {});
//     // below are 4 retry statements to avoid any failure
//     const sftpIntegraionAt04_2 = agenda.create('sftpIntegraionAt04_2', {});
//     const sftpIntegraionAt04_3 = agenda.create('sftpIntegraionAt04_3', {});
//     const sftpIntegraionAt04_4 = agenda.create('sftpIntegraionAt04_4', {});
//     const sftpIntegraionAt04_5 = agenda.create('sftpIntegraionAt04_5', {});

//     const integrateNow04 = agenda.create('integrateNow04', {});

//     const integrateNow13 = agenda.create('integrateNow13', {});

//     const passwordChangeNotificationRemainder = agenda.create(
//       'passwordChangeNotificationRemainder',
//       {},
//     );

//     // LBS Approve download file locally at '/public/approve/' path
//     const sftpLBSApproveToUploadFileLocally_1 = agenda.create(
//       'sftpLBSApproveToUploadFileLocally_1',
//       {},
//     );

//     // below are 2 retry statements to avoid any failure
//     const sftpLBSApproveToUploadFileLocally_2 = agenda.create(
//       'sftpLBSApproveToUploadFileLocally_2',
//       {},
//     );
//     const sftpLBSApproveToUploadFileLocally_3 = agenda.create(
//       'sftpLBSApproveToUploadFileLocally_3',
//       {},
//     );

//     // LBS Approve proccess downloaded file locally at '/public/approve' path
//     const lbsApproveProccessCSV = agenda.create('lbsApproveProccessCSV', {});

//     const uploadLBSPlanCSV = agenda.create('uploadLBSPlanCSV', {});

//     // LBS Quota download file locally at '/public/quota/' path

//     const sftpLBSQuotaToUploadFileLocally_1 = agenda.create(
//       'sftpLBSQuotaToUploadFileLocally_1',
//       {},
//     );

//     const sftpLBSQuotaToUploadFileLocally_2 = agenda.create(
//       'sftpLBSQuotaToUploadFileLocally_2',
//       {},
//     );

//     // LBS Quota - proccess the locally downloaded file to update the database

//     const lbsQuotaProccessCSV = agenda.create('lbsQuotaProccessCSV', {});

//     await agenda.start();

//     // every One Minute Cron
//     await everyOneMinuteCron
//       .repeatEvery('*/1 * * * *', options)
//       .unique({})
//       .save();

//     // every day at 5:30
//     await sftpIntegraionAt13_1
//       .repeatEvery('30 5 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt13_2
//       .repeatEvery('31 5 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt13_3
//       .repeatEvery('32 5 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt13_4
//       .repeatEvery('33 5 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt13_5
//       .repeatEvery('34 5 * * *', options)
//       .unique({})
//       .save();

//     // every day at 23:30
//     await sftpIntegraionAt04_1
//       .repeatEvery('30 23 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt04_2
//       .repeatEvery('31 23 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt04_3
//       .repeatEvery('32 23 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt04_4
//       .repeatEvery('33 23 * * *', options)
//       .unique({})
//       .save();
//     await sftpIntegraionAt04_5
//       .repeatEvery('34 23 * * *', options)
//       .unique({})
//       .save();

//     await integrateNow04.repeatEvery('40 23 * * *', options).unique({}).save();

//     await integrateNow13.repeatEvery('40 5 * * *', options).unique({}).save();

//     // every day at 1:1
//     await passwordChangeNotificationRemainder
//       .repeatEvery('1 1 * * *', options)
//       .unique({})
//       .save();

//     await uploadLBSPlanCSV
//       .repeatEvery('15 18 * * *', options)
//       .unique({})
//       .save();

//     // every day at 19:30
//     await sftpLBSApproveToUploadFileLocally_1
//       .repeatEvery('30 19 * * *', options)
//       .unique({})
//       .save();
//     await sftpLBSApproveToUploadFileLocally_2
//       .repeatEvery('40 19 * * *', options)
//       .unique({})
//       .save();
//     await sftpLBSApproveToUploadFileLocally_3
//       .repeatEvery('50 19 * * *', options)
//       .unique({})
//       .save();

//     await lbsApproveProccessCSV
//       .repeatEvery('00 20 * * *', options)
//       .unique({})
//       .save();

//     await sftpLBSQuotaToUploadFileLocally_1
//       .repeatEvery('30 18 * * *', options)
//       .unique({})
//       .save();
//     await sftpLBSQuotaToUploadFileLocally_2
//       .repeatEvery('35 18 * * *', options)
//       .unique({})
//       .save();

//     await lbsQuotaProccessCSV
//       .repeatEvery('40 18 * * *', options)
//       .unique({})
//       .save();
//   })();

//   // everyOneMinuteCron
//   agenda.define('everyOneMinuteCron', {}, async (job, done) => {
//     logInfo('every One Minute Cron called');

//     cronObj
//       .publishingPost()
//       .then((result) => {
//         logInfo('publishingPost done', result);
//       })
//       .catch((err) => {
//         logError('publishingPost', err.stack);
//       });

//     cronObj
//       .challengeNotification()
//       .then((result) => {
//         logInfo('challengeNotification done', result);
//       })
//       .catch((err) => {
//         logError('challengeNotification', err.stack);
//       });
//     cronObj
//       .notificationReminder()
//       .then((result) => {
//         logInfo('notificationReminder done', result);
//       })
//       .catch((err) => {
//         logError('notificationReminder', err.stack);
//       });
//     cronObj
//       .taskNotification()
//       .then((result) => {
//         logInfo('taskNotification done', result);
//       })
//       .catch((err) => {
//         logError('taskNotification', err.stack);
//       });
//     cronObj
//       .notification()
//       .then((result) => {
//         logInfo('notification', result);
//       })
//       .catch((err) => {
//         logError('notification', err.stack);
//       });

//     cronObj
//       .passwordChangeNotification()
//       .then((result) => {
//         logInfo('passwordChangeNotification', result);
//       })
//       .catch((err) => {
//         logError('passwordChangeNotification', err.stack);
//       });
//     done();
//   });

//   // sftpIntegraionAt13
//   agenda.define('sftpIntegraionAt13_1', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt13_1');
//     cronObj
//       .sftpIntegraionAt13()
//       .then((result) => {
//         logInfo('sftpIntegraionAt13_1', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt13_1', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt13_2', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt13_2');
//     cronObj
//       .sftpIntegraionAt13()
//       .then((result) => {
//         logInfo('sftpIntegraionAt13_2', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt13_2', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt13_3', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt13_3');
//     cronObj
//       .sftpIntegraionAt13()
//       .then((result) => {
//         logInfo('sftpIntegraionAt13_3', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt13_3', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt13_4', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt13_4');
//     cronObj
//       .sftpIntegraionAt13()
//       .then((result) => {
//         logInfo('sftpIntegraionAt13_4', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt13_4', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt13_5', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt13_5');
//     cronObj
//       .sftpIntegraionAt13()
//       .then((result) => {
//         logInfo('sftpIntegraionAt13_5', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt13_5', err);
//       });
//     done();
//   });

//   // sftpIntegraionAt04
//   agenda.define('sftpIntegraionAt04_1', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt04_1');
//     cronObj
//       .sftpIntegraionAt04()
//       .then((result) => {
//         logInfo('sftpIntegraionAt04_1', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt04_1', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt04_2', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt04_2');
//     cronObj
//       .sftpIntegraionAt04()
//       .then((result) => {
//         logInfo('sftpIntegraionAt04_2', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt04_2', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt04_3', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt04_3');
//     cronObj
//       .sftpIntegraionAt04()
//       .then((result) => {
//         logInfo('sftpIntegraionAt04_3', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt04_3', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt04_4', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt04_4');
//     cronObj
//       .sftpIntegraionAt04()
//       .then((result) => {
//         logInfo('sftpIntegraionAt04_4', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt04_4', err);
//       });
//     done();
//   });
//   agenda.define('sftpIntegraionAt04_5', {}, async (job, done) => {
//     logInfo('sftpIntegraionAt04_5');
//     cronObj
//       .sftpIntegraionAt04()
//       .then((result) => {
//         logInfo('sftpIntegraionAt04_5', result);
//       })
//       .catch((err) => {
//         logError('sftpIntegraionAt04_5', err);
//       });
//     done();
//   });
//   // integrateNow04
//   agenda.define('integrateNow04', {}, async (job, done) => {
//     logInfo('integrateNow04');
//     cronObj
//       .integrateNow04()
//       .then((result) => {
//         logInfo('integrateNow04', result);
//       })
//       .catch((err) => {
//         logError('integrateNow04', err);
//       });
//     done();
//   });
//   // integrateNow13
//   agenda.define('integrateNow13', {}, async (job, done) => {
//     logInfo('integrateNow13');
//     cronObj
//       .integrateNow13()
//       .then((result) => {
//         logInfo('integrateNow13', result);
//       })
//       .catch((err) => {
//         logError('integrateNow13', err);
//       });
//     done();
//   });
//   // passwordChangeNotificationRemainder
//   agenda.define(
//     'passwordChangeNotificationRemainder',
//     {},
//     async (job, done) => {
//       logInfo('passwordChangeNotificationRemainder');
//       cronObj
//         .passwordChangeNotificationRemainder()
//         .then((result) => {
//           logInfo('passwordChangeNotificationRemainder', result);
//         })
//         .catch((err) => {
//           logError('passwordChangeNotificationRemainder', err);
//         });
//       done();
//     },
//   );
//   // uploadLBSPlanCSV
//   agenda.define('uploadLBSPlanCSV', {}, async (job, done) => {
//     logInfo('uploadLBSPlanCSV');
//     cronObj
//       .uploadLBSPlanCSV()
//       .then((result) => {
//         logInfo('uploadLBSPlanCSV', result);
//       })
//       .catch((err) => {
//         logError('uploadLBSPlanCSV', err);
//       });
//     done();
//   });

//   // sftpLBSApproveToUploadFileLocally
//   agenda.define(
//     'sftpLBSApproveToUploadFileLocally_1',
//     {},
//     async (job, done) => {
//       logInfo('sftpLBSApproveToUploadFileLocally_1');
//       cronObj
//         .sftpLBSApproveToUploadFileLocally()
//         .then((result) => {
//           logInfo('sftpLBSApproveToUploadFileLocally_1', result);
//         })
//         .catch((err) => {
//           logError('sftpLBSApproveToUploadFileLocally_1', err);
//         });
//       done();
//     },
//   );
//   agenda.define(
//     'sftpLBSApproveToUploadFileLocally_2',
//     {},
//     async (job, done) => {
//       logInfo('sftpLBSApproveToUploadFileLocally_2');
//       cronObj
//         .sftpLBSApproveToUploadFileLocally()
//         .then((result) => {
//           logInfo('sftpLBSApproveToUploadFileLocally_2', result);
//         })
//         .catch((err) => {
//           logError('sftpLBSApproveToUploadFileLocally_2', err);
//         });
//       done();
//     },
//   );
//   agenda.define(
//     'sftpLBSApproveToUploadFileLocally_3',
//     {},
//     async (job, done) => {
//       logInfo('sftpLBSApproveToUploadFileLocally_3');
//       cronObj
//         .sftpLBSApproveToUploadFileLocally()
//         .then((result) => {
//           logInfo('sftpLBSApproveToUploadFileLocally_3', result);
//         })
//         .catch((err) => {
//           logError('sftpLBSApproveToUploadFileLocally_3', err);
//         });
//       done();
//     },
//   );
//   // lbsApproveProccessCSV
//   agenda.define('lbsApproveProccessCSV', {}, async (job, done) => {
//     logInfo('lbsApproveProccessCSV');
//     cronObj
//       .lbsApproveProccessCSV()
//       .then((result) => {
//         logInfo('lbsApproveProccessCSV', result);
//       })
//       .catch((err) => {
//         logError('lbsApproveProccessCSV', err);
//       });
//     done();
//   });

//   // sftpLBSQuotaToUploadFileLocally
//   agenda.define('sftpLBSQuotaToUploadFileLocally_1', {}, async (job, done) => {
//     logInfo('sftpLBSQuotaToUploadFileLocally_1');
//     cronObj
//       .sftpLBSQuotaToUploadFileLocally()
//       .then((result) => {
//         logInfo('sftpLBSQuotaToUploadFileLocally_1', result);
//       })
//       .catch((err) => {
//         logError('sftpLBSQuotaToUploadFileLocally_1', err);
//       });
//     done();
//   });
//   agenda.define('sftpLBSQuotaToUploadFileLocally_2', {}, async (job, done) => {
//     logInfo('sftpLBSQuotaToUploadFileLocally_2');
//     cronObj
//       .sftpLBSQuotaToUploadFileLocally()
//       .then((result) => {
//         logInfo('sftpLBSQuotaToUploadFileLocally_2', result);
//       })
//       .catch((err) => {
//         logError('sftpLBSQuotaToUploadFileLocally_2', err);
//       });
//     done();
//   });

//   // lbsQuotaProccessCSV
//   agenda.define('lbsQuotaProccessCSV', {}, async (job, done) => {
//     logInfo('lbsQuotaProccessCSV');
//     cronObj
//       .lbsQuotaProccessCSV()
//       .then((result) => {
//         logInfo('lbsQuotaProccessCSV', result);
//       })
//       .catch((err) => {
//         logError('lbsQuotaProccessCSV', err);
//       });
//     done();
//   });
// }
