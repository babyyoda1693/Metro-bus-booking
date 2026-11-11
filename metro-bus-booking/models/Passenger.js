const mongoose = require('mongoose');

// Passenger details are stored once per phone number and refreshed on every booking
const passengerSchema = new mongoose.Schema(
  {
    Passenger_Name: { type: String, required: true, trim: true },
    Phone: { type: String, required: true, unique: true, trim: true },
    Email: { type: String, required: true, trim: true, lowercase: true },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: { transform: (doc, ret) => { delete ret._id; return ret; } },
  }
);

module.exports = mongoose.model('Passenger', passengerSchema);
