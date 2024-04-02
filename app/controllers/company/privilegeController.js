// Controller Code Starts here
const Privilege = require('../../models/privilege');
const privilegeCategoryController = require('./privilegeCategoryController');
const __ = require('../../../helpers/globalFunctions');

class PrivilegeController {
  async create(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
        'flags',
        'privilegeCategoryId',
      ]);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const insert = req.body;
        // create new model
        const insertedPrivilege = await new Privilege(insert).save();

        // save model to MongoDB
        req.body.privilegeId = insertedPrivilege._id;
        const params = {
          privilegeId: insertedPrivilege._id,
          privilegeCategoryId: req.body.privilegeCategoryId,
        };

        privilegeCategoryController.push(
          params,
          res,
        ); /* push generated city id in state table (field name : privilegeIds) */
        this.read(
          req,
          res,
        ); /* calling read fn with privilegeId(last insert id). it calls findOne fn in read */
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      const where = {
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.privilegeId) {
        where._id = req.body.privilegeId;
        findOrFindOne = Privilege.findOne(where);
      } else findOrFindOne = Privilege.find(where);

      const privileges = await findOrFindOne
        .populate({
          path: 'privilegeCategoryId',
          select: '_id name',
        })
        .lean();

      __.out(res, 201, {
        privileges,
      });
    } catch (err) {
      __.log(err);
      __.out(res, 500, err);
    }
  }

  async update(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, ['privilegeId']);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const doc = await Privilege.findOne({
          _id: req.body.privilegeId,
          status: {
            $ne: 3,
          },
        });

        if (doc === null) {
          __.out(res, 300, 'Invalid privilegeId');
        } else {
          let isPrivilegeCategoryEdited = false;

          if (
            req.body.privilegeCategoryId &&
            doc.privilegeCategoryId !== req.body.privilegeCategoryId
          ) {
            isPrivilegeCategoryEdited = true;
            const params = {
              privilegeId: req.body.privilegeId,
              privilegeCategoryId:
                doc.privilegeCategoryId /* existing privilegeCategoryId */,
            };

            privilegeCategoryController.pull(
              params,
              res,
            ); /* pull this city id in from existing state (field name : privilegeIds) */
          }

          doc.set(req.body);
          const result = await doc.save();

          if (result === null) {
            __.out(res, 300, 'Something went wrong');
          } else {
            if (isPrivilegeCategoryEdited) {
              const params = {
                privilegeId: req.body.privilegeId,
                privilegeCategoryId:
                  req.body
                    .privilegeCategoryId /* current privilegeCategoryId */,
              };

              privilegeCategoryController.push(
                params,
                res,
              ); /* push generated city id in state table (field name : privilegeIds) */
            }

            this.read(req, res);
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async delete(req, res) {
    try {
      const requiredResult = await __.checkRequiredFields(req, ['privilegeId']);

      if (requiredResult.status === false) {
        __.out(res, 400, requiredResult.missingFields);
      } else {
        const doc = await Privilege.findOne({
          _id: req.body.privilegeId,
          status: {
            $ne: 3,
          },
        });

        if (doc === null) {
          __.out(res, 300, 'Invalid privilegeId');
        } else {
          doc.status = 3;
          const result = await doc.save();

          if (result === null) {
            __.out(res, 300, 'Something went wrong');
          } else {
            __.out(res, 200);
          }
        }
      }
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }
}
const privilege = new PrivilegeController();

module.exports = privilege;
