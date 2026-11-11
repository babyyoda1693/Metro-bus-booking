const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    Booking_ID: { type: String, required: true, unique: true },
    Passenger_Name: { type: String, required: [true, 'Passenger_Name is required'], trim: true },
    Phone: { type: String, required: [true, 'Phone is required'], trim: true, match: [/^\+?[0-9]{9,15}$/, 'Phone must be 9-15 digits, optionally starting with +'] },
    Email: { type: String, required: [true, 'Email is required'], trim: true, lowercase: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid'] },
    Bus_ID: { type: String, required: [true, 'Bus_ID is required'], uppercase: true, trim: true },
    Travel_Date: { type: String, required: true },
    Seat_Number: { type: String, required: [true, 'Seat_Number is required'], uppercase: true, trim: true },
    Boarding_Point: { type: String, required: true, trim: true },
    Destination: { type: String, required: true, trim: true },
    Fare: { type: Number, required: true, min: 0 },
    Booking_Status: { type: String, enum: ['Confirmed', 'Cancelled'], default: 'Confirmed' },
  },
  {
    versionKey: false,
    toJSON: { transform: (doc, ret) => { delete ret._id; return ret; } },
  }
);

// A seat can only be held by one confirmed booking per bus (cancelled bookings free the seat)
bookingSchema.index(
  { Bus_ID: 1, Seat_Number: 1 },
  { unique: true, partialFilterExpression: { Booking_Status: 'Confirmed' } }
);
bookingSchema.index({ Phone: 1 });
bookingSchema.index({ Email: 1 });
bookingSchema.index({ Travel_Date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
