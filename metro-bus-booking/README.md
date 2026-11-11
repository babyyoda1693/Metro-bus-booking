# Metro Bus Booking

Node.js + Express REST API, MongoDB (Mongoose), and a Bootstrap 5 + jQuery front end that talks to the API with AJAX/JSON.

## Run it
1. Install Node.js 18+ and MongoDB (local, or an Atlas URI).
2. `npm install`
3. Copy `.env.example` to `.env` (already included) and set `MONGODB_URI` if needed.
4. `npm run seed` loads `data/buses.json` and `data/bookings.json`.
5. `npm start`, then open http://localhost:3000

## REST API
Buses (`/api/buses`)
| # | Service | Request |
|---|---------|---------|
| 1 | Insert a bus | `POST /api/buses` |
| 2 | Show all buses | `GET /api/buses` |
| 3 | Find by Bus ID | `GET /api/buses/:busId` |
| 4 | Find by route | `GET /api/buses/route/:route` |
| 5 | Find by departure | `GET /api/buses/departure/:departure` |
| 6 | Find by destination | `GET /api/buses/destination/:destination` |
| 7 | Find by travel date | `GET /api/buses/date/YYYY-MM-DD` |
| 8 | Find available buses | `GET /api/buses/available` |
| 9 | Update details | `PUT /api/buses/:busId` (Bus_Name, Route, Departure, Destination, Total_Seats, Fare) |
| 10 | Update schedule | `PUT /api/buses/:busId/schedule` (Travel_Date, Departure_Time, Arrival_Time) |
| 11 | Delete bus | `DELETE /api/buses/:busId` (`?force=true` if it has confirmed bookings) |
| + | Seat map | `GET /api/buses/:busId/seats` |

Bookings (`/api/bookings`)
| # | Service | Request |
|---|---------|---------|
| 1 | Insert a booking | `POST /api/bookings` (Passenger_Name, Phone, Email, Bus_ID, Seat_Number, Boarding_Point) |
| 2 | Show all bookings | `GET /api/bookings` |
| 3 | Find by Booking ID | `GET /api/bookings/:bookingId` |
| 4 | Find by passenger name | `GET /api/bookings/passenger/:name` |
| 5 | Find by phone | `GET /api/bookings/phone/:phone` |
| 6 | Find by email | `GET /api/bookings/email/:email` |
| 7 | Find by Bus ID | `GET /api/bookings/bus/:busId` |
| 8 | Find by travel date | `GET /api/bookings/date/YYYY-MM-DD` |
| 9 | Update booking | `PUT /api/bookings/:bookingId` (Passenger_Name, Phone, Email, Boarding_Point, Seat_Number) |
| 10 | Cancel booking | `DELETE /api/bookings/:bookingId` (status becomes Cancelled, seat is released) |

Passengers: `GET /api/passengers`, `GET /api/passengers/phone/:phone`.

## Modules
Bus, route and schedule management live in `busController.js`; seats in `busController.seats`; passengers and bookings in `passengerController.js` and `bookingController.js`; search in the `by*` handlers. MongoDB collections: `buses`, `bookings`, `passengers`.

## jQuery uses (public/js/app.js)
1. Delegated event handling (Book, Edit, Cancel, seat clicks)
2. DOM building from JSON (tables, seat map, ticket)
3. Effects (slideDown/slideToggle/fadeIn/fadeOut for alerts, panels, views)
4. Form handling: `serializeArray` to JSON plus validation styling
5. Live table filtering and dynamic search input (type, placeholder, enable/disable)

## Adding a feature
Create a model, controller and route file, register the route in `routes/index.js`, add one line to `public/js/api.js`, then use it from `app.js`. New search options are one entry in `BUS_SEARCHES` or `BOOKING_SEARCHES`.

## Notes
- Seat labels: columns A-B | aisle | C-D, rows from 1 (A12 = column A, row 12).
- A seat is unique per bus among confirmed bookings (partial unique index), and `Available_Seats` is updated atomically.
- `npm run seed` recalculates `Available_Seats` from the seeded confirmed bookings.
