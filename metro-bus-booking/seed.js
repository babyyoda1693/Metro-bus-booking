// Loads data/buses.json and data/bookings.json into MongoDB.  Run: npm run seed
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Bus = require('./models/Bus');
const Booking = require('./models/Booking');
const Passenger = require('./models/Passenger');
const buses = require('./data/buses.json');
const bookings = require('./data/bookings.json');

(async () => {
  await connectDB();
  await Promise.all([Bus.deleteMany({}), Booking.deleteMany({}), Passenger.deleteMany({})]);
  await Promise.all([Bus.syncIndexes(), Booking.syncIndexes(), Passenger.syncIndexes()]);

  // Available_Seats is recalculated from the confirmed bookings so seat map and counts agree
  const confirmed = {};
  bookings.forEach((b) => {
    if (b.Booking_Status === 'Confirmed') confirmed[b.Bus_ID] = (confirmed[b.Bus_ID] || 0) + 1;
  });
  await Bus.insertMany(buses.map((b) => ({ ...b, Available_Seats: b.Total_Seats - (confirmed[b.Bus_ID] || 0) })));
  await Booking.insertMany(bookings);
  for (const b of bookings) {
    await Passenger.updateOne({ Phone: b.Phone }, { $set: { Passenger_Name: b.Passenger_Name, Email: b.Email } }, { upsert: true });
  }

  console.log(`Seeded ${buses.length} buses and ${bookings.length} bookings`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
