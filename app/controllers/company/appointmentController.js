// Controller Code Starts here
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Appointment = require('../../models/appointment');
const __ = require('../../../helpers/globalFunctions');
const User = require('../../models/user');

class AppointmentController {
  async create(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'name',
        'status',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const duplicate = await Appointment.count({
        name: { $eq: req.body.name.trim() },
        status: { $nin: 3 },
        companyId: req.user.companyId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Appointment name already exists');
      }

      const insert = req.body;

      insert.companyId = req.user.companyId;
      const insertedDoc = await new Appointment(insert).save();

      req.body.appointmentId = insertedDoc._id;
      return this.read(
        req,
        res,
      ); /* calling read fn with appointmentId(last insert id). it calls findOne fn in read */
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAll(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        status: 1,
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.appointmentId) {
        where._id = req.body.appointmentId;
        findOrFindOne = Appointment.findOne(where);
      } else {
        const data = await this.findAll(where, req.query);

        return res.json({ data });
      }

      const appointments = await findOrFindOne.lean();

      return __.out(res, 201, {
        appointments,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAllAppointmentFromUser(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const { businessUnitId, allBuToken } = req.body;
      const where = {
        companyId: req.user.companyId,
        status: 1,
      };

      if (businessUnitId && businessUnitId.length > 0) {
        where.parentBussinessUnitId = {
          $in: businessUnitId.map((b) => mongoose.Types.ObjectId(b)),
        };
      }

      if (allBuToken) {
        where.parentBussinessUnitId = { $in: req.user.planBussinessUnitId };
      }

      const data = await this.findAllUser(where, req.query);

      return res.json({ data });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async findAll(where, { page = 1, limit = 10, search, sortBy, sortWith }) {
    const searchCondition = {};

    if (search) {
      searchCondition.name = { $regex: search, $options: 'i' };
    }

    limit = Number(limit);
    page = Number(page);
    const skip = (page - 1) * limit;
    const searchObj = { ...where, ...searchCondition };

    const sort = {
      [sortWith]: sortBy === 'desc' ? -1 : 1,
    };

    const allResult = [
      Appointment.find(searchObj, { _id: 1, name: 1 })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
    ];

    if (page === 1) {
      allResult.push(Appointment.countDocuments(searchObj));
      const [data, count] = await Promise.all(allResult);

      return { count, data };
    }

    const [data] = await Promise.all(allResult);

    return { data };
  }

  async findAllUser(where, { search }) {
    const searchCondition = {};

    if (search) {
      searchCondition.name = { $regex: search, $options: 'i' };
    }

    const sort = {
      name: 1,
    };

    const data = await User.aggregate([
      { $match: where },
      {
        $group: {
          _id: '$appointmentId',
        },
      },
      {
        $lookup: {
          from: 'appointments',
          localField: '_id',
          foreignField: '_id',
          as: 'appointment',
          pipeline: [
            {
              $match: searchCondition,
            },
            {
              $project: {
                name: 1,
                _id: 0,
              },
            },
          ],
        },
      },
      { $unwind: '$appointment' },
      {
        $project: {
          _id: 1,
          name: '$appointment.name',
        },
      },
      { $sort: sort },
    ]);

    return data;
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const where = {
        companyId: req.user.companyId,
        status: {
          $ne: 3 /* $ne => not equal */,
        },
      };
      let findOrFindOne;

      /* if ID given then it acts as findOne which gives object else find which gives array of object */
      if (req.body.appointmentId) {
        where._id = req.body.appointmentId;
        findOrFindOne = Appointment.findOne(where);
      } else findOrFindOne = Appointment.find(where);

      const appointments = await findOrFindOne.lean();

      return __.out(res, 201, {
        appointments,
      });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async readWithPn(req, res) {
    try {
      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const limit = 10;
      let page = req.body.page ? parseInt(req.body.page, 10) * limit : 0; // skip from appointment dropdown

      page = page || (req.body.start ? parseInt(req.body.start, 10) : 0); // skip from appointment table
      const query = {
        companyId: mongoose.Types.ObjectId(req.user.companyId),
        status: {
          $in: [1],
        },
      };
      const recordsTotal = await Appointment.count(query);

      if (req.body.q !== undefined) {
        query.name = {
          $regex: req.body.q.toString(),
          $options: 'ixs',
        };
      }

      const recordsFiltered = await Appointment.count(query).lean();
      const appointments = await Appointment.find(query)
        .skip(page)
        .limit(limit)
        .lean();

      appointments.forEach((a, i) => {
        a.sno = page + i + 1;
      });

      return res
        .status(201)
        .json({ appointments, recordsTotal, recordsFiltered });
    } catch (error) {
      __.log(error);
      return __.out(res, 300, error);
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'appointmentId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const doc = await Appointment.findOne({
        _id: req.body.appointmentId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (doc === null) {
        return __.out(res, 300, 'Invalid appointmentId');
      }

      const duplicate = await Appointment.count({
        name: { $eq: req.body.name.trim() },
        status: { $nin: 3 },
        companyId: req.user.companyId,
      });

      if (duplicate !== 0) {
        return __.out(res, 300, 'Appointment name already exists');
      }

      doc.set(req.body);
      const result = await doc.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return this.read(req, res);
    } catch (err) {
      __.log(err);
      return __.out(res, 300, 'Something went wrong try later');
    }
  }

  async delete(req, res) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({ errorMessage: errors.array() });
      }

      if (!__.checkHtmlContent(req.body)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      const requiredResult = await __.checkRequiredFields(req, [
        'appointmentId',
      ]);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const appointmentResult = await Appointment.findOne({
        _id: req.body.appointmentId,
        companyId: req.user.companyId,
        status: {
          $ne: 3,
        },
      });

      if (appointmentResult === null) {
        return __.out(res, 300, 'Invalid appointmentId');
      }

      appointmentResult.status = 3;
      const result = await appointmentResult.save();

      if (result === null) {
        return __.out(res, 300, 'Something went wrong');
      }

      return __.out(res, 200);
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }

  async getAppointments(req, res) {
    try {
      const query = {
        $match: {
          status: 1,
          companyId: mongoose.Types.ObjectId(req.user.companyId),
        },
      };

      if (!!req.query && !!req.query.q) {
        query.$match.name = {
          $regex: `${req.query.q}`,
          $options: 'is',
        };
      }

      const limit = 300;
      const skip = req.query.page ? parseInt(req.query.page, 10) * limit : 0;
      const appointments = await Appointment.aggregate([
        query,
        {
          $project: { name: 1 },
        },
        {
          $sort: {
            name: 1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ]);

      return __.out(res, 201, appointments);
    } catch (error) {
      return __.out(res, 300, 'Something went wrong try later');
    }
  }
}
/* */
const appointment = new AppointmentController();

module.exports = appointment;
