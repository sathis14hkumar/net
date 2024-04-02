const AdminUser = require('../../models/adminUser');
const __ = require('../../../helpers/globalFunctions');

class SuperAdminListController {
  async getList(req, res) {
    try {
      return await AdminUser.find(null, 'name userName', (err, data) => {
        if (err) {
          return __.out(res, 500);
        }

        return __.out(res, 200, data);
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

const superAdminListController = new SuperAdminListController();

module.exports = superAdminListController;
