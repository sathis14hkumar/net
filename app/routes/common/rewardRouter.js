const express = require('express');

const rewardsRouter = express.Router();
const rewardsController = require('../../controllers/common/rewardsController');
const __ = require('../../../helpers/globalFunctions');

// //RENDER
// rewardsRouter.use(
//   passport.authenticate("jwt", {
//     session: false
//   }) /*Allow only admin*/,
//   function (req, res, next) {
//     next();
//   }
// );

rewardsRouter.get('/login', (req, res) => {
  rewardsController.redemptionLogin(req, res);
});

const myRewards = async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege?.myRewards) {
    switch (req.route.path) {
      case '/redemptionGamification':
        rewardsController.redemptionGamification(req, res);
        break;

      case '/redemptionHistory':
        rewardsController.rewardsDbHistory(req, res);
        break;

      case '/reward':
        rewardsController.redemptionReward(req, res);
        break;

      case '/wishlist':
        rewardsController.redemptionWishlist(req, res);
        break;

      case '/deleteWishlist':
        rewardsController.deleteWishlist(req, res);
        break;

      case '/redemptionNew':
        rewardsController.redemptionNew(req, res);
        break;

      case '/redemptionPopular':
        rewardsController.redemptionPopular(req, res);
        break;

      case '/getCategorywiseList':
        rewardsController.rewardCategorywiseList(req, res);
        break;

      case '/redeemedVouchersDetails/:productCode':
        rewardsController.redeemedVouchersDetails(req, res);
        break;

      case '/vouchersRequest/:productCode':
        rewardsController.redemptionVouchersRequest(req, res);
        break;

      case '/saveVoucherDetail':
        rewardsController.saveVoucherDetail(req, res);
        break;

      case '/getVoucherList':
        rewardsController.getVoucherList(req, res);
        break;

      case '/redeemedRewardSaveProduct/:productCode':
        rewardsController.redeemedRewardSaveProductDetails(req, res);
        break;

      default:
        break;
    }
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
};

rewardsRouter.get('/redemptionGamification', myRewards);
rewardsRouter.get('/redemptionHistory', myRewards);
rewardsRouter.post('/reward', myRewards);
rewardsRouter.post('/wishlist', myRewards);
rewardsRouter.post('/deleteWishlist', myRewards);
rewardsRouter.get('/redemptionNew', myRewards);
rewardsRouter.get('/redemptionPopular', myRewards);
rewardsRouter.get('/getCategorywiseList', myRewards);
rewardsRouter.get('/redeemedVouchersDetails/:productCode', myRewards);
rewardsRouter.get('/vouchersRequest/:productCode', myRewards);
rewardsRouter.post('/saveVoucherDetail', myRewards);
rewardsRouter.get('/getVoucherList', myRewards);
rewardsRouter.get('/redeemedRewardSaveProduct/:productCode', myRewards);

rewardsRouter.get('/type/:rewardType', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.myRewards) {
    rewardsController.redemptionType(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get(
  '/category/:rewardCategory/:subCategory',
  async (req, res) => {
    const routeprivilege = await __.getPrivilegeData(req.user);

    if (routeprivilege.myRewards) {
      rewardsController.redemptionCategory(req, res);
    } else {
      return __.out(res, 300, 'This account is not permitted to access');
    }

    return Promise.resolve();
  },
);

rewardsRouter.get('/details/:rewardDetails', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.myRewards) {
    rewardsController.redemptionDetails(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get('/history/:rewardHistory/:rewardDate', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.myRewards) {
    rewardsController.redemptionHistory(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get('/search/:rewardSearch', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.myRewards) {
    rewardsController.redemptionSearch(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get('/rewardsHistory', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.redemptionList) {
    rewardsController.rewardsHistory(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get('/rewardsHistoryExport', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.redemptionList) {
    rewardsController.rewardsHistoryExport(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

rewardsRouter.get('/rewardsHistoryExport', async (req, res) => {
  const routeprivilege = await __.getPrivilegeData(req.user);

  if (routeprivilege.redemptionList) {
    rewardsController.rewardsHistoryExport(req, res);
  } else {
    return __.out(res, 300, 'This account is not permitted to access');
  }

  return Promise.resolve();
});

module.exports = rewardsRouter;
