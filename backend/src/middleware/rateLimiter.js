'use strict';

const noop = (_req, _res, next) => next();

module.exports = {
  generalLimiter: noop,
  authLimiter: noop,
  purchaseLimiter: noop,
  adminLimiter: noop,
};
