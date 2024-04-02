const Emojis = require('../../models/emoji');
const __ = require('../../../helpers/globalFunctions');

class Emoji {
  async upload(req, res) {
    try {
      if (!req.file) return __.out(res, 300, `No File is Uploaded`);

      __.scanFile(
        req.file.filename,
        `public/uploads/emojis/${req.file.filename}`,
      );

      const insert = req.body;

      insert.companyId = req.user.companyId;
      insert.name = req.file.filename;
      insert.status = 1;
      insert.emoji = `uploads/emojis/${req.file.filename}`;
      const insertedDoc = await new Emojis(insert).save();

      if (!insertedDoc) __.out(res, 300, 'Error while uploading Emoji');

      return __.out(res, 201, 'Uploaded successfully!');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async get(req, res) {
    try {
      const where = {
        companyId: req.user.companyId,
        status: {
          $nin: [0, 3],
        },
      };
      const emojiData = await Emojis.find(where)
        .select(' emoji _id name ')
        .lean();

      if (!emojiData) return __.out(res, 300, 'Oops something went wrong');

      return __.out(res, 201, emojiData);
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }

  async remove(req, res) {
    try {
      // Check required fields
      const requiredResult = await __.checkRequiredFields(req, ['emojiId']);

      if (requiredResult.status === false) {
        return __.out(res, 400, requiredResult.missingFields);
      }

      const query = {
        _id: req.body.emojiId,
        status: {
          $nin: [3],
        },
      };
      const update = {
        status: 3,
      };
      const options = {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      };

      const emojiData = await Emojis.findOneAndUpdate(query, update, options);

      if (!emojiData) return __.out(res, 300, 'Oops something went wrong');

      return __.out(res, 201, 'Removed Successfully');
    } catch (error) {
      __.log(error);
      return __.out(res, 500, error);
    }
  }
}

const emoji = new Emoji();

module.exports = emoji;
