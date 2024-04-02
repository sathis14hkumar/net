const express = require('express');

const superAdminListRouter = express.Router();
const superAdminListController = require('../../controllers/superadmin/list');

superAdminListRouter.post('/', (req, res) => {
  superAdminListController.getList(req, res);
});

module.exports = superAdminListRouter;
