const mongoose = require('mongoose');

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const busSchema = new mongoose.Schema(
  {
    Bus_ID: { type: String, required: [true, 'Bus_ID is required'], unique: true, trim: true, uppercase: true },
    Bus_Name: { type: String, required: [true, 'Bus_Name is required'], trim: true },
    Route: { type: String, required: [true, 'Route is required'], trim: true },
    Departure: { type: String, required: [true, 'Departure is required'], trim: true },
    Destination: { type: String, required: [true, 'Destination is required'], trim: true },
    Travel_Date: { type: String, required: [true, 'Travel_Date is required'], match: [DATE_RE, 'Travel_Date must be YYYY-MM-DD'] },
    Departure_Time: { type: String, required: [true, 'Departure_Time is required'], match: [TIME_RE, 'Departure_Time must be HH:MM'] },
    Arrival_Time: { type: String, required: [true, 'Arrival_Time is required'], match: [TIME_RE, 'Arrival_Time must be HH:MM'] },
    Total_Seats: { type: Number, required: [true, 'Total_Seats is required'], min: [1, 'Total_Seats must be at least 1'], validate: { validator: Number.isInteger, message: 'Total_Seats must be a whole number' } },
    Available_Seats: { type: Number, required: true, min: [0, 'Available_Seats cannot be negative'], validate: { validator: Number.isInteger, message: 'Available_Seats must be a whole number' } },
    Fare: { type: Number, required: [true, 'Fare is required'], min: [0, 'Fare cannot be negative'] },
  },
  {
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret._id; return ret; } },
  }
);

busSchema.pre('validate', function (next) {
  if (this.Available_Seats > this.Total_Seats) {
    this.invalidate('Available_Seats', 'Available_Seats cannot exceed Total_Seats');
  }
  next();
});

busSchema.index({ Travel_Date: 1, Departure_Time: 1 });

module.exports = mongoose.model('Bus', busSchema);
