const Bus = require('../models/Bus');
const Booking = require('../models/Booking');
const { HttpError, asyncHandler, escapeRegex, pick, generateSeatLabels, assertDate } = require('../utils/helpers');

const SORT = { Travel_Date: 1, Departure_Time: 1 };
const DETAIL_FIELDS = ['Bus_Name', 'Route', 'Departure', 'Destination', 'Total_Seats', 'Fare'];
const SCHEDULE_FIELDS = ['Travel_Date', 'Departure_Time', 'Arrival_Time'];

const like = (value) => new RegExp(escapeRegex(value), 'i');

async function findBusOr404(busId) {
  const bus = await Bus.findOne({ Bus_ID: String(busId).toUpperCase() });
  if (!bus) throw new HttpError(404, `Bus ${busId} not found`);
  return bus;
}

async function nextBusId() {
  const rows = await Bus.find({ Bus_ID: /^MB\d+$/ }).select('Bus_ID').lean();
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.Bus_ID.slice(2), 10)), 1000);
  return `MB${max + 1}`;
}

// 1. Insert a Metro Bus
exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (!body.Bus_ID) body.Bus_ID = await nextBusId();
  if (body.Available_Seats === undefined) body.Available_Seats = body.Total_Seats;
  const bus = await Bus.create(body);
  res.status(201).json(bus);
});

// 2. Show all Metro Buses (also accepts ?route=&departure=&destination=&date=&available=true)
exports.getAll = asyncHandler(async (req, res) => {
  const { route, departure, destination, date, available } = req.query;
  const filter = {};
  if (route) filter.Route = like(route);
  if (departure) filter.Departure = like(departure);
  if (destination) filter.Destination = like(destination);
  if (date) filter.Travel_Date = assertDate(date);
  if (available === 'true') filter.Available_Seats = { $gt: 0 };
  res.json(await Bus.find(filter).sort(SORT));
});

// 3. Find a Metro Bus by Bus ID
exports.getById = asyncHandler(async (req, res) => {
  res.json(await findBusOr404(req.params.busId));
});

// 4-6. Find by Route / Departure / Destination (case-insensitive, partial match)
const byText = (field) =>
  asyncHandler(async (req, res) => {
    res.json(await Bus.find({ [field]: like(req.params.value) }).sort(SORT));
  });
exports.byRoute = byText('Route');
exports.byDeparture = byText('Departure');
exports.byDestination = byText('Destination');

// 7. Find Buses by Travel Date
exports.byDate = asyncHandler(async (req, res) => {
  res.json(await Bus.find({ Travel_Date: assertDate(req.params.date) }).sort(SORT));
});

// 8. Find Available Buses (seats left, optional ?date=)
exports.available = asyncHandler(async (req, res) => {
  const filter = { Available_Seats: { $gt: 0 } };
  if (req.query.date) filter.Travel_Date = assertDate(req.query.date);
  res.json(await Bus.find(filter).sort(SORT));
});

// 9. Update Metro Bus Details (name, route, departure, destination, seats, fare)
exports.updateDetails = asyncHandler(async (req, res) => {
  const bus = await findBusOr404(req.params.busId);
  const changes = pick(req.body, DETAIL_FIELDS);

  if (changes.Total_Seats !== undefined) {
    const newTotal = Number(changes.Total_Seats);
    const booked = bus.Total_Seats - bus.Available_Seats;
    if (!Number.isInteger(newTotal) || newTotal < booked) {
      throw new HttpError(400, `Total_Seats must be a whole number of at least ${booked} (seats already booked)`);
    }
    changes.Total_Seats = newTotal;
    bus.Available_Seats = newTotal - booked;
  }
  bus.set(changes);
  res.json(await bus.save());
});

// 10. Update Metro Bus Schedule (date and times). Confirmed bookings follow the new date.
exports.updateSchedule = asyncHandler(async (req, res) => {
  const bus = await findBusOr404(req.params.busId);
  const changes = pick(req.body, SCHEDULE_FIELDS);
  if (!Object.keys(changes).length) throw new HttpError(400, 'Provide Travel_Date, Departure_Time or Arrival_Time');
  bus.set(changes);
  const saved = await bus.save();
  if (changes.Travel_Date) {
    await Booking.updateMany({ Bus_ID: bus.Bus_ID }, { $set: { Travel_Date: saved.Travel_Date } });
  }
  res.json(saved);
});

// 11. Delete Metro Bus by Bus ID (refuses if confirmed bookings exist, unless ?force=true)
exports.remove = asyncHandler(async (req, res) => {
  const bus = await findBusOr404(req.params.busId);
  const confirmed = await Booking.countDocuments({ Bus_ID: bus.Bus_ID, Booking_Status: 'Confirmed' });
  if (confirmed > 0 && req.query.force !== 'true') {
    throw new HttpError(409, `Bus ${bus.Bus_ID} has ${confirmed} confirmed booking(s). Use force=true to delete and cancel them.`);
  }
  if (confirmed > 0) {
    await Booking.updateMany({ Bus_ID: bus.Bus_ID, Booking_Status: 'Confirmed' }, { $set: { Booking_Status: 'Cancelled' } });
  }
  await bus.deleteOne();
  res.json({ message: `Bus ${bus.Bus_ID} deleted`, cancelled_bookings: confirmed });
});

// Seat Management: seat map for one bus
exports.seats = asyncHandler(async (req, res) => {
  const bus = await findBusOr404(req.params.busId);
  const taken = new Set(await Booking.distinct('Seat_Number', { Bus_ID: bus.Bus_ID, Booking_Status: 'Confirmed' }));
  const Seats = generateSeatLabels(bus.Total_Seats).map((Seat_Number) => ({
    Seat_Number,
    Status: taken.has(Seat_Number) ? 'Booked' : 'Available',
  }));
  res.json({ Bus_ID: bus.Bus_ID, Total_Seats: bus.Total_Seats, Available_Seats: bus.Available_Seats, Seats });
});
