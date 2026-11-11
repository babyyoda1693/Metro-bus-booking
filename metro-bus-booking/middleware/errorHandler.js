const { HttpError } = require('../utils/helpers');

const notFound = (req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: errors.join(', '), errors });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: `Invalid value for ${err.path}` });
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return res.status(409).json({ message: `Duplicate value for: ${field}` });
  }
  if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ message: 'Invalid JSON body' });

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};

module.exports = { notFound, errorHandler };
