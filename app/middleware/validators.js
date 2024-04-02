const { validationResult, checkExact } = require('express-validator');

const validateRequestExactMatch = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errorMessage: errors.array() });
  }

  const result = await checkExact().run(req);

  if (!result.isEmpty()) {
    return res
      .status(400)
      .json({ errorMessage: 'unknown fields in the request' });
  }

  return next();
};

const validateRequest = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errorMessage: errors.array() });
  }

  return next();
};

const isObjectId = /^[0-9a-fA-F]{24}$/;

const searchRegex = /^$|[a-zA-Z0-9\s]+$/;

const validateSearchRegex = (value) => searchRegex.test(value);

const fileValidator = (file) => {
  const methods = {
    validate: async (req, res, next) => {
      if (!req[file]) {
        return res.status(400).json({ errorMessage: 'File is required' });
      }

      return next();
    },
  };

  return Object.freeze(methods);
};

module.exports = {
  validateRequestExactMatch,
  validateRequest,
  isObjectId,
  fileValidator,
  searchRegex,
  validateSearchRegex,
};
