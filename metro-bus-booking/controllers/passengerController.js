const Passenger = require('../models/Passenger');
const { HttpError, asyncHandler, escapeRegex } = require('../utils/helpers');

// Passenger Management: list stored passengers
exports.getAll = asyncHandler(async (req, res) => {
  res.json(await Passenger.find().sort({ Passenger_Name: 1 }));
});

exports.byPhone = asyncHandler(async (req, res) => {
  const passenger = await Passenger.findOne({ Phone: new RegExp(escapeRegex(req.params.phone) + '$') });
  if (!passenger) throw new HttpError(404, 'Passenger not found');
  res.json(passenger);
});
