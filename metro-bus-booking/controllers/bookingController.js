const Bus = require('../models/Bus');
const Booking = require('../models/Booking');
const Passenger = require('../models/Passenger');
const { HttpError, asyncHandler, escapeRegex, pick, generateSeatLabels, assertDate, today } = require('../utils/helpers');

const SORT = { Travel_Date: 1, Booking_ID: 1 };
const EDITABLE_FIELDS = ['Passenger_Name', 'Phone', 'Email', 'Boarding_Point', 'Seat_Number'];

async function findBookingOr404(bookingId) {
  const booking = await Booking.findOne({ Booking_ID: String(bookingId).toUpperCase() });
  if (!booking) throw new HttpError(404, `Booking ${bookingId} not found`);
  return booking;
}

// Booking_ID = BK + travel date (YYYYMMDD) + 3-digit sequence, e.g. BK20261015001
async function generateBookingId(travelDate) {
  const prefix = 'BK' + travelDate.replace(/-/g, '');
  const last = await Booking.findOne({ Booking_ID: new RegExp('^' + prefix) }).sort({ Booking_ID: -1 }).lean();
  const seq = last ? parseInt(last.Booking_ID.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(seq).padStart(3, '0');
}

const savePassenger = ({ Passenger_Name, Phone, Email }) =>
  Passenger.updateOne({ Phone }, { $set: { Passenger_Name, Email } }, { upsert: true });

const isSeatConflict = (err) => err.code === 11000 && err.keyPattern && err.keyPattern.Seat_Number;

// 1. Insert a Passenger Booking
exports.create = asyncHandler(async (req, res) => {
  const { Passenger_Name, Phone, Email, Bus_ID, Boarding_Point } = req.body;
  const Seat_Number = String(req.body.Seat_Number || '').trim().toUpperCase();
  if (!Bus_ID || !Seat_Number) throw new HttpError(400, 'Bus_ID and Seat_Number are required');

  const bus = await Bus.findOne({ Bus_ID: String(Bus_ID).toUpperCase() });
  if (!bus) throw new HttpError(404, `Bus ${Bus_ID} not found`);
  if (bus.Travel_Date < today()) throw new HttpError(400, 'This bus has already departed');
  if (req.body.Travel_Date && req.body.Travel_Date !== bus.Travel_Date) {
    throw new HttpError(400, `Bus ${bus.Bus_ID} travels on ${bus.Travel_Date}`);
  }
  if (!generateSeatLabels(bus.Total_Seats).includes(Seat_Number)) {
    throw new HttpError(400, `Seat ${Seat_Number} does not exist on this bus`);
  }
  if (await Booking.exists({ Bus_ID: bus.Bus_ID, Seat_Number, Booking_Status: 'Confirmed' })) {
    throw new HttpError(409, `Seat ${Seat_Number} is already booked`);
  }

  // Reserve a seat atomically so two requests cannot oversell the bus
  const reserved = await Bus.findOneAndUpdate(
    { Bus_ID: bus.Bus_ID, Available_Seats: { $gt: 0 } },
    { $inc: { Available_Seats: -1 } }
  );
  if (!reserved) throw new HttpError(409, 'No seats left on this bus');

  const release = () => Bus.updateOne({ Bus_ID: bus.Bus_ID }, { $inc: { Available_Seats: 1 } });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const booking = await Booking.create({
        Booking_ID: await generateBookingId(bus.Travel_Date),
        Passenger_Name, Phone, Email,
        Bus_ID: bus.Bus_ID,
        Travel_Date: bus.Travel_Date,
        Seat_Number,
        Boarding_Point: Boarding_Point || bus.Departure,
        Destination: bus.Destination,
        Fare: bus.Fare,
        Booking_Status: 'Confirmed',
      });
      await savePassenger(booking);
      return res.status(201).json(booking);
    } catch (err) {
      const idClash = err.code === 11000 && err.keyPattern && err.keyPattern.Booking_ID;
      if (idClash && attempt < 2) continue; // another booking took that ID, try the next one
      await release();
      if (isSeatConflict(err)) throw new HttpError(409, `Seat ${Seat_Number} is already booked`);
      throw err;
    }
  }
});

// 2. Show all Bookings
exports.getAll = asyncHandler(async (req, res) => {
  res.json(await Booking.find().sort(SORT));
});

// 3. Find a Booking by Booking ID
exports.getById = asyncHandler(async (req, res) => {
  res.json(await findBookingOr404(req.params.bookingId));
});

// 4. Find Bookings by Passenger Name (partial, case-insensitive)
exports.byPassenger = asyncHandler(async (req, res) => {
  res.json(await Booking.find({ Passenger_Name: new RegExp(escapeRegex(req.params.name), 'i') }).sort(SORT));
});

// 5. Find Bookings by Phone Number (partial match so "0771001001" finds "+94771001001")
exports.byPhone = asyncHandler(async (req, res) => {
  const digits = req.params.phone.replace(/^0+/, '');
  res.json(await Booking.find({ Phone: new RegExp(escapeRegex(digits)) }).sort(SORT));
});

// 6. Find Bookings by Email
exports.byEmail = asyncHandler(async (req, res) => {
  res.json(await Booking.find({ Email: new RegExp('^' + escapeRegex(req.params.email) + '$', 'i') }).sort(SORT));
});

// 7. Find Bookings by Bus ID
exports.byBus = asyncHandler(async (req, res) => {
  res.json(await Booking.find({ Bus_ID: req.params.busId.toUpperCase() }).sort(SORT));
});

// 8. Find Bookings by Travel Date
exports.byDate = asyncHandler(async (req, res) => {
  res.json(await Booking.find({ Travel_Date: assertDate(req.params.date) }).sort(SORT));
});

// 9. Update Booking Details (passenger info, boarding point, seat)
exports.update = asyncHandler(async (req, res) => {
  const booking = await findBookingOr404(req.params.bookingId);
  if (booking.Booking_Status === 'Cancelled') throw new HttpError(400, 'A cancelled booking cannot be updated');

  const changes = pick(req.body, EDITABLE_FIELDS);
  if (changes.Seat_Number !== undefined) {
    const seat = String(changes.Seat_Number).trim().toUpperCase();
    if (seat !== booking.Seat_Number) {
      const bus = await Bus.findOne({ Bus_ID: booking.Bus_ID });
      if (!bus || !generateSeatLabels(bus.Total_Seats).includes(seat)) {
        throw new HttpError(400, `Seat ${seat} does not exist on this bus`);
      }
      if (await Booking.exists({ Bus_ID: booking.Bus_ID, Seat_Number: seat, Booking_Status: 'Confirmed' })) {
        throw new HttpError(409, `Seat ${seat} is already booked`);
      }
    }
    changes.Seat_Number = seat;
  }

  booking.set(changes);
  try {
    await booking.save();
  } catch (err) {
    if (isSeatConflict(err)) throw new HttpError(409, `Seat ${changes.Seat_Number} is already booked`);
    throw err;
  }
  await savePassenger(booking);
  res.json(booking);
});

// 10. Cancel a Booking by Booking ID (keeps the record, frees the seat)
exports.cancel = asyncHandler(async (req, res) => {
  const booking = await findBookingOr404(req.params.bookingId);
  if (booking.Booking_Status === 'Cancelled') throw new HttpError(400, 'Booking is already cancelled');

  booking.Booking_Status = 'Cancelled';
  await booking.save();
  await Bus.updateOne({ Bus_ID: booking.Bus_ID }, [
    { $set: { Available_Seats: { $min: [{ $add: ['$Available_Seats', 1] }, '$Total_Seats'] } } },
  ]);
  res.json({ message: `Booking ${booking.Booking_ID} cancelled`, booking });
});
