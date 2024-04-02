const mongoose = require('mongoose');
const IntegrationModel = require('../../models/integration');
const IntegrationMasterDataModel = require('../../models/integrationMasterData');
const __ = require('../../../helpers/globalFunctions');

class Integration {
  async read(req, res) {
    try {
      const draw = req.query.draw || 0;
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {};
      const recordsTotal = await IntegrationModel.count({
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        sourcePath: { $nin: ['Quota', 'Approve'] },
      });

      if (req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };

        query.$or = [
          { 'company.name': searchQuery },
          { sourcePath: searchQuery },
          { errorMessage: searchQuery },
          { status: searchQuery },
          { noOfNewUsers: parseInt(req.query.search.value, 10) },
          { noOfUpdatedUsers: parseInt(req.query.search.value, 10) },
          { faildUpdateUsers: parseInt(req.query.search.value, 10) },
        ];
      }

      let sort = { createdAt: -1 };

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);
        const sortData = [
          `company.name`,
          `status`,
          `noOfNewUsers`,
          `noOfUpdatedUsers`,
          `faildUpdateUsers`,
          `createdAt`,
          `errorFilePath`,
        ];

        sort = orderData.reduce((prev, curr) => {
          prev[sortData[parseInt(curr.column, 10)]] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      const agger = [
        {
          $match: {
            companyId: mongoose.Types.ObjectId(req.user.companyId),
            sourcePath: { $nin: ['Quota', 'Approve'] },
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            'company.name': 1,
            sourcePath: 1,
            errorFilePath: 1,
            noOfNewUsers: { $size: { $ifNull: ['$newUsers', []] } },
            noOfUpdatedUsers: { $size: { $ifNull: ['$updatedUsers', []] } },
            faildUpdateUsers: { $size: { $ifNull: ['$nonUpdatedUsers', []] } },
            status: 1,
            createdAt: 1,
            errorMessage: 1,
          },
        },
      ];

      const dataAggregation = [
        ...agger,
        {
          $facet: {
            data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
            count: [{ $count: 'total' }],
          },
        },
        {
          $unwind: '$count',
        },
      ];

      const [result] = await IntegrationModel.aggregate(dataAggregation);

      const finalResult = {
        draw,
        recordsTotal,
        recordsFiltered: result.count ? result.count.total : 0,
        data: result.data || [],
      };

      return res.status(201).json(finalResult);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readQuota(req, res) {
    try {
      const draw = req.query.draw || 0;
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {};
      const recordsTotal = await IntegrationModel.count({
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        sourcePath: 'Quota',
      });

      if (req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };

        query.$or = [
          { 'company.name': searchQuery },
          { sourcePath: 'Quota' },
          { errorMessage: searchQuery },
          { status: searchQuery },
          { noOfNewUsers: parseInt(req.query.search.value, 10) },
          { noOfUpdatedUsers: parseInt(req.query.search.value, 10) },
          { faildUpdateUsers: parseInt(req.query.search.value, 10) },
        ];
      }

      let sort = { createdAt: -1 };

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);
        const sortData = [
          `company.name`,
          `status`,
          `noOfNewUsers`,
          `noOfUpdatedUsers`,
          `faildUpdateUsers`,
          `createdAt`,
          `errorFilePath`,
        ];

        sort = orderData.reduce((prev, curr) => {
          prev[sortData[parseInt(curr.column, 10)]] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      const agger = [
        {
          $match: {
            companyId: mongoose.Types.ObjectId(req.user.companyId),
            sourcePath: 'Quota',
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            'company.name': 1,
            sourcePath: 1,
            errorFilePath: 1,
            noOfNewUsers: { $size: { $ifNull: ['$newUsers', []] } },
            noOfUpdatedUsers: { $size: { $ifNull: ['$updatedUsers', []] } },
            faildUpdateUsers: { $size: { $ifNull: ['$nonUpdatedUsers', []] } },
            status: 1,
            createdAt: 1,
            errorMessage: 1,
          },
        },
        {
          $match: query,
        },
      ];

      const dataAggregation = [
        ...agger,
        {
          $facet: {
            data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
            count: [{ $count: 'total' }],
          },
        },
        {
          $unwind: '$count',
        },
      ];

      const [result] = await IntegrationModel.aggregate(dataAggregation);

      const finalResult = {
        draw,
        recordsTotal,
        recordsFiltered: result.count ? result.count.total : 0,
        data: result.data || [],
      };

      return res.status(201).json(finalResult);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readApprove(req, res) {
    try {
      const draw = req.query.draw || 0;
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {};
      const recordsTotal = await IntegrationModel.count({
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        sourcePath: 'Approve',
      });

      if (req.query.search && req.query.search.value) {
        const searchQuery = {
          $regex: `${req.query.search.value}`,
          $options: 'ixs',
        };

        query.$or = [
          { 'company.name': searchQuery },
          { sourcePath: 'Approve' },
          { errorMessage: searchQuery },
          { status: searchQuery },
          { noOfNewUsers: parseInt(req.query.search.value, 10) },
          { noOfUpdatedUsers: parseInt(req.query.search.value, 10) },
          { faildUpdateUsers: parseInt(req.query.search.value, 10) },
        ];
      }

      let sort = { createdAt: -1 };

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);
        const sortData = [
          `company.name`,
          `status`,
          `noOfNewUsers`,
          `noOfUpdatedUsers`,
          `faildUpdateUsers`,
          `createdAt`,
          `errorFilePath`,
        ];

        sort = orderData.reduce((prev, curr) => {
          prev[sortData[parseInt(curr.column, 10)]] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      const agger = [
        {
          $match: {
            companyId: mongoose.Types.ObjectId(req.user.companyId),
            sourcePath: 'Approve',
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            'company.name': 1,
            sourcePath: 1,
            errorFilePath: 1,
            noOfNewUsers: { $size: { $ifNull: ['$newUsers', []] } },
            noOfUpdatedUsers: { $size: { $ifNull: ['$updatedUsers', []] } },
            faildUpdateUsers: { $size: { $ifNull: ['$nonUpdatedUsers', []] } },
            status: 1,
            createdAt: 1,
            errorMessage: 1,
          },
        },
        {
          $match: query,
        },
      ];

      const dataAggregation = [
        ...agger,
        {
          $facet: {
            data: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
            count: [{ $count: 'total' }],
          },
        },
        {
          $unwind: '$count',
        },
      ];

      const [result] = await IntegrationModel.aggregate(dataAggregation);

      const finalResult = {
        draw,
        recordsTotal,
        recordsFiltered: result.count ? result.count.total : 0,
        data: result.data || [],
      };

      return res.status(201).json(finalResult);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async readMasterData(req, res) {
    try {
      const draw = req.query.draw || 0;
      const pageNum = req.query.start ? parseInt(req.query.start, 10) : 0;
      const limit = req.query.length ? parseInt(req.query.length, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum * limit) / limit;
      const query = {};
      const recordsTotal = await IntegrationMasterDataModel.count({
        companyId: mongoose.Types.ObjectId(req.user.companyId),
      });
      /* if (req.query.search && req.query.search.value) {
                const searchQuery = {
                    $regex: `${req.query.search.value}`,
                    $options: "ixs"
                };
                query["$or"] = [{'company.name': searchQuery},
                    {sourcePath: searchQuery},
                    {errorMessage: searchQuery},
                    {status: searchQuery},
                    {noOfNewUsers: parseInt(req.query.search.value)},
                    {noOfUpdatedUsers: parseInt(req.query.search.value)},
                    {faildUpdateUsers: parseInt(req.query.search.value)}];
            } */
      let sort = { _id: -1 };

      if (req.query.order) {
        const orderData = req.query.order;
        const getSort = (val) => (val === 'asc' ? 1 : -1);
        const sortData = [
          `company.name`,
          `status`,
          `noOfNewUsers`,
          `noOfUpdatedUsers`,
          `faildUpdateUsers`,
          `createdAt`,
          `errorFilePath`,
        ];

        sort = orderData.reduce((prev, curr) => {
          prev[sortData[parseInt(curr.column, 10)]] = getSort(curr.dir);
          return prev;
        }, sort);
      }

      const agger = [
        {
          $match: {
            companyId: mongoose.Types.ObjectId(req.user.companyId),
          },
        },
        {
          $lookup: {
            from: 'companies',
            localField: 'companyId',
            foreignField: '_id',
            as: 'company',
          },
        },
        {
          $unwind: '$company',
        },
        {
          $project: {
            'company.name': 1,
            sourcePath: 1,
            errorFilePath: 1,
            /* noOfNewUsers: { $cond: { if: { $isArray: '$newUsers' }, then: { $size: '$newUsers' }, else: 0 } },
                    noOfUpdatedUsers: { $cond: { if: { $isArray: '$updatedUsers' }, then: { $size: '$updatedUsers' }, else: 0 } },
                    faildUpdateUsers: { $cond: { if: { $isArray: '$nonUpdatedUsers' }, then: { $size: '$nonUpdatedUsers' }, else: 0 } }, */
            newTier2: {
              $cond: {
                if: { $isArray: '$tier2.new' },
                then: { $size: '$tier2.new' },
                else: 0,
              },
            },
            newTier3: {
              $cond: {
                if: { $isArray: '$tier3.new' },
                then: { $size: '$tier3.new' },
                else: 0,
              },
            },
            newTitle: {
              $cond: {
                if: { $isArray: '$title.new' },
                then: { $size: '$title.new' },
                else: 0,
              },
            },
            status: 1,
            createdAt: 1,
            errorMessage: 1,
          },
        },
        {
          $match: query,
        },
      ];

      const recordsFilteredData = await IntegrationMasterDataModel.aggregate(
        agger,
      );
      const data = await IntegrationMasterDataModel.aggregate([
        ...agger,
        {
          $sort: sort,
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);
      const result = {
        draw,
        recordsTotal,
        recordsFiltered: recordsFilteredData.length,
        data,
      };

      return res.status(201).json(result);
    } catch (error) {
      __.log(error);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}
module.exports = new Integration();
