const PostLog = require('../../models/postLog');
const __ = require('../../../helpers/globalFunctions');
const { logInfo } = require('../../../helpers/logger.helper');
const User = require('../../models/user');

class PostLogController {
  async create(data, res) {
    try {
      const insert = {
        channelId: data.channelId,
        categoryId: data.categoryId,
        teaser: data.teaser,
        content: data.content,
        eventDetails: data.eventDetails,
        publishing: data.publishing,
        userOptions: data.userOptions,
        postType: data.postType,
        status: data.status,
        authorId: data.authorId,
        wallId: data.wallId,
        wallName: data.wallName,
        id: data.id,
      };

      if (data.logstatus === 1) {
        insert.logDescription = `Creating new post`;
      }

      if (data.logstatus === 2) {
        insert.logDescription = `Updating existing post`;
      }

      const isAdded = await new PostLog(insert).save();

      if (isAdded) __.log('Log Added Successfully');
    } catch (err) {
      __.log(err);
      __.out(res, 500);
    }
  }

  async read(req, res) {
    try {
      if (!__.checkHtmlContent(req.query)) {
        return __.out(res, 300, `You've entered malicious input`);
      }

      logInfo('postLogController::read');
      const pageNum = req.query.page ? parseInt(req.query.page, 10) : 0;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      const skip = req.query.skip
        ? parseInt(req.query.skip, 10)
        : (pageNum - 1) * limit;
      const id = req.query.postId;
      const where = {};

      if (id) {
        where.id = id;
      }

      const totalUserCount = await PostLog.count(where).lean();
      let isSearched = false;
      const sort = { createdAt: -1 };

      if (req.query.search) {
        isSearched = true;
        where.$or = [
          {
            wallName: {
              $regex: `${req.query.search.value}`,
              $options: 'i',
            },
          },
        ];
      }

      const logData = await PostLog.find(where)
        .populate({
          path: 'authorId',
          select: '_id name parentBussinessUnitId profilePicture',
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      let totalCount = 0;

      if (isSearched) totalCount = await User.count(where).lean();
      else totalCount = totalUserCount;

      const result = {
        draw: req.query.draw || 0,
        recordsTotal: totalUserCount || 0,
        count: totalCount || 0,
        data: logData,
      };

      return res.status(200).json({ data: result });
    } catch (err) {
      __.log(err);
      return __.out(res, 500);
    }
  }
}

module.exports = new PostLogController();
