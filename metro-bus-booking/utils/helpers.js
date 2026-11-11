class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wrap async route handlers so errors reach the error middleware
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = (obj, keys) =>
  keys.reduce((out, k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
    return out;
  }, {});

// Seat layout: columns A-B | aisle | C-D, rows numbered from 1 (A1, B1, C1, D1, A2 ...)
const SEAT_COLUMNS = ['A', 'B', 'C', 'D'];
function generateSeatLabels(total) {
  const labels = [];
  for (let row = 1; labels.length < total; row++) {
    for (const col of SEAT_COLUMNS) {
      if (labels.length >= total) break;
      labels.push(col + row);
    }
  }
  return labels;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const assertDate = (value) => {
  if (!DATE_RE.test(value)) throw new HttpError(400, 'Date must use the format YYYY-MM-DD');
  return value;
};

// Local date as YYYY-MM-DD
const today = () => new Date().toLocaleDateString('en-CA');

module.exports = { HttpError, asyncHandler, escapeRegex, pick, generateSeatLabels, assertDate, today };
