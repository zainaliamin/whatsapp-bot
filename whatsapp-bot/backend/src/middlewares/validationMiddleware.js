const { ApiError } = require("../utils/ApiError");

function validate(schema) {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

    if (error) {
      return next(new ApiError(400, "Validation failed", error.details.map((d) => d.message)));
    }

    req.body = value;
    return next();
  };
}

module.exports = { validate };
