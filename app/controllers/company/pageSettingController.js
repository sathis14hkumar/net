const fs = require('fs-extra');
const { validationResult } = require('express-validator');
const PageSettingModel = require('../../models/pageSetting');
const __ = require('../../../helpers/globalFunctions');
const opsleave = require('./opsLeaveManagementController');

class PageSetting {
  // return the pageSetting data
  async read(req, res) {
    try {
      let pageSettingData = await PageSettingModel.findOne({
        companyId: req.user.companyId,
        status: 1,
      })
        .populate({
          path: 'loginFields',
        })
        .select(
          'bannerImages loginFields quickLinks externalLinks pwdSettings buTemplateId isChallengeIncluded isTaskViewIncluded isFormsIncluded isBoardsIncluded opsGroup loginFields adminEmail notificRemindDays notificRemindHours techEmail compliments suggestions pointSystems',
        )
        .lean();

      if (!pageSettingData) {
        // Create new one if not exists
        const newData = {
          companyId: req.user.companyId,
          bannerImages: [],
          quickLinks: [],
          externalLinks: [],
          loginFields: [],
          status: 1,
          opsGroup: {
            blockLeaveConfiguration: 1,
            slotType: 1,
            leaveAdjust: false,
          },
          pointSystems: __.initPointSystem(req.user.companyId, true),
        };

        pageSettingData = await new PageSettingModel(newData).save();
      }

      if (
        !pageSettingData.pointSystems ||
        !pageSettingData.pointSystems.length
      ) {
        pageSettingData.pointSystems = await __.initPointSystem(
          req.user.companyId,
        );
      }

      // let quick link convert to object
      const quickLinkPermissions = {};

      for (const elem of pageSettingData.quickLinks) {
        quickLinkPermissions[elem.screenName] = elem.status === 'active';
      }
      pageSettingData.isTaskViewIncluded = !!pageSettingData.isTaskViewIncluded;
      pageSettingData.isChallengeIncluded =
        !!pageSettingData.isChallengeIncluded;
      pageSettingData.isFormsIncluded = !!pageSettingData.isFormsIncluded;
      pageSettingData.isBoardsIncluded = !!pageSettingData.isBoardsIncluded;
      pageSettingData.quickLinkPermissions = quickLinkPermissions;
      // Banner Image remove timer from response
      // pageSettingData.bannerImages = pageSettingData.bannerImages.map(v=>{
      //     return v.link
      // })
      if (req.body.internalApi === true) {
        return pageSettingData;
      }

      return __.out(res, 201, pageSettingData);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // banner Image & External Link icons upload
  async uploadFiles(req, res) {
    try {
      const { file } = req;

      if (!file) {
        return __.out(res, 300, `No File is Uploaded`);
      }

      const time = new Date().getTime();
      const storePath = `uploads/pageSetting/${time}_${file.originalname}`;

      const filePath = `${__.serverBaseUrl()}uploads/pageSetting/${time}_${
        req.file.originalname
      }`;

      fs.writeFileSync(`public/${storePath}`, file.buffer);

      const result = await __.scanFile(
        file.originalname,
        `public/uploads/pageSetting/${time}_${file.originalname}`,
      );

      if (result) {
        return __.out(res, 300, result);
      }

      return __.out(res, 201, {
        link: filePath,
        exactPath: `uploads/pageSetting/${time}_${req.file.originalname}`,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500, err);
    }
  }

  // update the  bannerImage List, key given for quick navigation by user and the external link given by user
  async update(req, res) {
    // debugger;
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      if (!__.checkSpecialCharacters(req.body, 'page settings')) {
        return __.out(
          res,
          301,
          `You've entered some excluded special characters`,
        );
      }

      const where = {
        _id: req.body.pageId,
        companyId: req.user.companyId,
        status: 1,
      };
      const pageSettingData = await PageSettingModel.findOneAndUpdate(
        where,
        { $set: { ...req.body } },
        { new: true },
      ).lean();

      opsleave.myMethod.autoTerminateSwapRequest();
      if (!pageSettingData) return __.out(res, 300, 'Page not found');

      return __.out(res, 201, 'Updated Successfully!');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  // update the  bannerImage List, key given for quick navigation by user and the external link given by user
  async updatePwdManage(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'pageId',
        'pwdSettings',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      if (!__.checkSpecialCharacters(req.body, 'page settings')) {
        return __.out(
          res,
          301,
          `You've entered some excluded special characters`,
        );
      }

      const where = {
        _id: req.body.pageId,
        companyId: req.user.companyId,
        status: 1,
      };
      const pageSettingData = await PageSettingModel.findOneAndUpdate(
        where,
        {
          $set: {
            pwdSettings: req.body.pwdSettings,
            updatedBy: req.user._id,
          },
        },
        {
          new: true,
        },
      ).lean();

      if (!pageSettingData) return __.out(res, 300, 'Page not found');

      return __.out(res, 201, 'Updated Successfully!');
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async readSkillSet(req, res) {
    try {
      const pageSettingData = await PageSettingModel.findOne(
        {
          companyId: req.user.companyId,
          status: 1,
        },
        { opsGroup: 1 },
      );
      const { tierType } = pageSettingData.opsGroup;

      return res.status(200).json({ tierType });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

/* Exporting Module */
module.exports = new PageSetting();
