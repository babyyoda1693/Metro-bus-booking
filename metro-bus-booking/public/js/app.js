/* Metro Bus Booking - front end.
 *
 * The five jQuery techniques used (search for "jQuery #n"):
 *   #1 Event handling with delegation   (clicks on rows that are created later)
 *   #2 DOM building / templating        (.html(), .append(), .text(), .data())
 *   #3 Effects and animation            (.slideDown(), .fadeIn(), .fadeOut(), .slideToggle())
 *   #4 Form handling and validation     (.serializeArray(), .addClass('is-invalid'))
 *   #5 Live filtering + dynamic inputs  (keyup + .filter()/.toggle(), .attr('type'), .prop())
 * Server calls are in api.js ($.ajax with JSON).
 */
$(function () {
  'use strict';

  const state = { bus: null, seat: null, busList: [], bookingList: [] };

  // ---------- helpers ----------
  const esc = (s) => $('<div>').text(s == null ? '' : s).html();
  const money = (n) => 'LKR ' + Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const prettyDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // jQuery #3: animated notifications
  function notify(message, type) {
    const $a = $('<div class="alert shadow-sm" role="alert"></div>')
      .addClass('alert-' + (type || 'success')).text(message).hide();
    $('#alertBox').append($a);
    $a.slideDown(180);
    setTimeout(() => $a.fadeOut(400, () => $a.remove()), 4200);
  }
  const fail = (err) => notify(err.message || 'Something went wrong', 'danger');

  // jQuery #4: form -> JSON object, with validation styling
  function formData($form) {
    const out = {};
    $.each($form.serializeArray(), function (_, f) {
      const $f = $form.find('[name="' + f.name + '"]');
      out[f.name] = $f.data('type') === 'number' ? (f.value === '' ? '' : Number(f.value)) : f.value.trim();
    });
    return out;
  }
  function validate($form) {
    let ok = true;
    $form.find('input[required], select[required]').each(function () {
      const $f = $(this);
      const val = $.trim($f.val());
      const pattern = $f.data('pattern');
      const valid = val !== '' && (!pattern || new RegExp('^' + pattern + '$').test(val));
      $f.toggleClass('is-invalid', !valid);
      if (!valid) ok = false;
    });
    return ok;
  }
  $(document).on('input change', '.is-invalid', function () { $(this).removeClass('is-invalid'); });

  // ---------- navigation ----------
  function showView(name) {
    $('#mainNav .nav-link').removeClass('active').filter('[data-view="' + name + '"]').addClass('active');
    $('.view').addClass('d-none');
    $('#view-' + name).removeClass('d-none').hide().fadeIn(180); // jQuery #3
    if (name === 'admin') loadAdminBuses();
    if (name === 'bookings' && !state.bookingList.length) runBookingSearch();
  }
  // jQuery #1: one delegated handler for every [data-view] button on the page
  $(document).on('click', '[data-view]', function () { showView($(this).data('view')); });

  // ---------- search configuration (add a search by adding one entry) ----------
  const BUS_SEARCHES = {
    all:         { label: 'All buses',       call: () => Api.buses.all(),                       noValue: true },
    id:          { label: 'Bus ID',          call: (v) => Api.buses.byId(v).then((b) => [b]),   placeholder: 'e.g. MB1001' },
    route:       { label: 'Route',           call: (v) => Api.buses.byRoute(v),                 placeholder: 'e.g. Colombo - Kandy' },
    departure:   { label: 'Departure',       call: (v) => Api.buses.byDeparture(v),             placeholder: 'e.g. Colombo Fort' },
    destination: { label: 'Destination',     call: (v) => Api.buses.byDestination(v),           placeholder: 'e.g. Galle' },
    date:        { label: 'Travel date',     call: (v) => Api.buses.byDate(v),                  type: 'date' },
    available:   { label: 'Available buses', call: () => Api.buses.available(),                 noValue: true },
  };
  const BOOKING_SEARCHES = {
    all:       { label: 'All bookings',   call: () => Api.bookings.all(),                          noValue: true },
    id:        { label: 'Booking ID',     call: (v) => Api.bookings.byId(v).then((b) => [b]),      placeholder: 'e.g. BK20261120001' },
    name:      { label: 'Passenger name', call: (v) => Api.bookings.byPassenger(v),                placeholder: 'e.g. Kumara' },
    phone:     { label: 'Phone number',   call: (v) => Api.bookings.byPhone(v),                    placeholder: 'e.g. +94771001001' },
    email:     { label: 'Email',          call: (v) => Api.bookings.byEmail(v),                    placeholder: 'e.g. kumara@gmail.com' },
    bus:       { label: 'Bus ID',         call: (v) => Api.bookings.byBus(v),                      placeholder: 'e.g. MB1001' },
    date:      { label: 'Travel date',    call: (v) => Api.bookings.byDate(v),                     type: 'date' },
  };

  // jQuery #5: the value input changes type, placeholder and state with the chosen search
  function bindSearchControls(config, $type, $value) {
    $.each(config, (key, cfg) => $type.append($('<option>').val(key).text(cfg.label)));
    $type.on('change', function () {
      const cfg = config[$type.val()];
      $value.attr('type', cfg.type || 'text').attr('placeholder', cfg.placeholder || '')
        .prop('disabled', !!cfg.noValue).val('').toggle(!cfg.noValue);
      $value.closest('div').find('label').toggle(!cfg.noValue);
    }).trigger('change');
  }

  // ---------- bus table ----------
  function seatsBadge(b) {
    const cls = b.Available_Seats === 0 ? 'bg-danger' : b.Available_Seats <= 8 ? 'bg-warning text-dark' : 'bg-success';
    return '<span class="badge seats-badge ' + cls + '">' + b.Available_Seats + ' / ' + b.Total_Seats + '</span>';
  }

  // jQuery #2: build table rows from JSON
  function renderBuses($tbody, buses, admin) {
    $tbody.empty();
    if (!buses.length) {
      $tbody.append('<tr><td colspan="7" class="text-center py-4">No buses match your search.</td></tr>');
      return;
    }
    $.each(buses, function (_, b) {
      const actions = admin
        ? '<button class="btn btn-sm btn-outline-dark btn-edit-bus me-1"><i class="bi bi-pencil"></i> Edit</button>' +
          '<button class="btn btn-sm btn-outline-danger btn-delete-bus"><i class="bi bi-trash"></i> Delete</button>'
        : '<button class="btn btn-sm btn-signal btn-book-bus"' + (b.Available_Seats === 0 ? ' disabled' : '') + '>Book</button>';
      $('<tr>').data('bus', b).html(
        '<td><div class="bus-name">' + esc(b.Bus_Name) + '</div><div class="bus-id">' + esc(b.Bus_ID) + '</div></td>' +
        '<td>' + esc(b.Route) + '<div class="bus-id">' + esc(b.Departure) + ' to ' + esc(b.Destination) + '</div></td>' +
        '<td>' + prettyDate(b.Travel_Date) + '</td>' +
        '<td>' + esc(b.Departure_Time) + ' - ' + esc(b.Arrival_Time) + '</td>' +
        '<td>' + seatsBadge(b) + '</td>' +
        '<td class="text-end">' + money(b.Fare) + '</td>' +
        '<td class="text-end text-nowrap">' + actions + '</td>'
      ).appendTo($tbody);
    });
  }

  function runBusSearch() {
    const key = $('#busSearchType').val();
    const cfg = BUS_SEARCHES[key];
    const value = $.trim($('#busSearchValue').val());
    if (!cfg.noValue && !value) { $('#busSearchValue').addClass('is-invalid'); return; }
    cfg.call(value).done(function (buses) {
      state.busList = buses;
      $('#busResultTitle').text(cfg.noValue ? cfg.label : cfg.label + ': ' + value + ' (' + buses.length + ')');
      $('#busQuickFilter').val('');
      renderBuses($('#busTable'), buses, false);
    }).fail(function (err) {
      if (err.status === 404) { renderBuses($('#busTable'), [], false); $('#busResultTitle').text('Nothing found'); }
      else fail(err);
    });
  }

  $('#busSearchForm').on('submit', function (e) { e.preventDefault(); runBusSearch(); });
  $('#busSearchReset').on('click', function () { $('#busSearchType').val('all').trigger('change'); runBusSearch(); });

  // ---------- booking tables ----------
  function renderBookings(bookings) {
    const $tbody = $('#bookingTable').empty();
    if (!bookings.length) {
      $tbody.append('<tr><td colspan="8" class="text-center py-4">No bookings match your search.</td></tr>');
      return;
    }
    $.each(bookings, function (_, b) {
      const cancelled = b.Booking_Status === 'Cancelled';
      $('<tr>').data('booking', b).html(
        '<td><div class="bus-name">' + esc(b.Booking_ID) + '</div></td>' +
        '<td>' + esc(b.Passenger_Name) + '</td>' +
        '<td>' + esc(b.Phone) + '<div class="bus-id">' + esc(b.Email) + '</div></td>' +
        '<td>' + esc(b.Bus_ID) + '<div class="bus-id">' + esc(b.Boarding_Point) + ' to ' + esc(b.Destination) + '</div></td>' +
        '<td>' + prettyDate(b.Travel_Date) + '</td>' +
        '<td>' + esc(b.Seat_Number) + '</td>' +
        '<td><span class="badge ' + (cancelled ? 'bg-secondary' : 'bg-success') + '">' + esc(b.Booking_Status) + '</span></td>' +
        '<td class="text-end text-nowrap">' +
          '<button class="btn btn-sm btn-outline-dark btn-edit-booking me-1"' + (cancelled ? ' disabled' : '') + '><i class="bi bi-pencil"></i> Edit</button>' +
          '<button class="btn btn-sm btn-outline-danger btn-cancel-booking"' + (cancelled ? ' disabled' : '') + '>Cancel</button>' +
        '</td>'
      ).appendTo($tbody);
    });
  }

  function runBookingSearch() {
    const key = $('#bookingSearchType').val();
    const cfg = BOOKING_SEARCHES[key];
    const value = $.trim($('#bookingSearchValue').val());
    if (!cfg.noValue && !value) { $('#bookingSearchValue').addClass('is-invalid'); return; }
    cfg.call(value).done(function (list) {
      state.bookingList = list;
      $('#bookingResultTitle').text(cfg.noValue ? cfg.label : cfg.label + ': ' + value + ' (' + list.length + ')');
      $('#bookingQuickFilter').val('');
      renderBookings(list);
    }).fail(function (err) {
      if (err.status === 404) { renderBookings([]); $('#bookingResultTitle').text('Nothing found'); }
      else fail(err);
    });
  }
  $('#bookingSearchForm').on('submit', function (e) { e.preventDefault(); runBookingSearch(); });
  $('#bookingSearchReset').on('click', function () { $('#bookingSearchType').val('all').trigger('change'); runBookingSearch(); });

  // jQuery #5: live filter - hides table rows that do not contain the typed text
  function liveFilter($input, $tbody) {
    $input.on('keyup', function () {
      const q = $.trim($(this).val()).toLowerCase();
      $tbody.find('tr').filter(function () {
        return $(this).data('bus') || $(this).data('booking');
      }).each(function () {
        $(this).toggle($(this).text().toLowerCase().indexOf(q) > -1);
      });
    });
  }
  liveFilter($('#busQuickFilter'), $('#busTable'));
  liveFilter($('#bookingQuickFilter'), $('#bookingTable'));

  // ---------- seat selection + booking ----------
  // jQuery #1: delegated click on "Book" buttons created by renderBuses()
  $(document).on('click', '.btn-book-bus', function () {
    openBooking($(this).closest('tr').data('bus'));
  });

  function openBooking(bus) {
    state.bus = bus;
    state.seat = null;
    $('#bookEmpty').addClass('d-none');
    $('#bookPanel').removeClass('d-none');
    $('#ticket').addClass('d-none').empty();
    $('#bookingForm')[0].reset();
    $('#bookingForm .is-invalid').removeClass('is-invalid');
    $('#bookBusId').val(bus.Bus_ID);
    $('#Boarding_Point').val(bus.Departure);
    $('#busSummary').html(
      '<div class="route">' + esc(bus.Route) + '</div>' +
      '<div>' + esc(bus.Bus_Name) + ' (' + esc(bus.Bus_ID) + ')</div>' +
      '<div>' + prettyDate(bus.Travel_Date) + ', ' + esc(bus.Departure_Time) + ' to ' + esc(bus.Arrival_Time) + '</div>' +
      '<div class="fw-semibold mt-1">' + money(bus.Fare) + ' per seat</div>'
    );
    showView('book');
    loadSeats();
  }

  function loadSeats() {
    Api.buses.seats(state.bus.Bus_ID).done(function (data) {
      const status = {};
      $.each(data.Seats, (_, s) => { status[s.Seat_Number] = s.Status; });
      const rows = Math.ceil(data.Total_Seats / 4);
      const $map = $('#seatMap').empty();

      // jQuery #2: build the seat grid (A B | aisle | C D)
      for (let r = 1; r <= rows; r++) {
        const $row = $('<div class="seat-row">').append($('<span class="row-no">').text(r));
        $.each(['A', 'B', 'AISLE', 'C', 'D'], function (_, col) {
          if (col === 'AISLE') { $row.append('<span class="aisle"></span>'); return; }
          const label = col + r;
          if (!status[label]) { $row.append('<span class="seat-empty"></span>'); return; }
          const booked = status[label] === 'Booked';
          $('<button type="button" class="seat">').text(label).data('seat', label)
            .addClass(booked ? 'booked' : 'available').prop('disabled', booked)
            .attr('aria-label', 'Seat ' + label + (booked ? ', booked' : ', available'))
            .toggleClass('selected', label === state.seat).appendTo($row);
        });
        $map.append($row);
      }
    }).fail(fail);
  }

  // jQuery #1: delegated click for seats
  $(document).on('click', '.seat.available', function () {
    $('.seat.selected').removeClass('selected');
    $(this).addClass('selected');
    state.seat = $(this).data('seat');
    $('#Seat_Number').val(state.seat).removeClass('is-invalid');
  });

  $('#bookingForm').on('submit', function (e) {
    e.preventDefault();
    const $form = $(this);
    if (!validate($form)) return;
    Api.bookings.create(formData($form)).done(function (b) {
      notify('Booking ' + b.Booking_ID + ' confirmed');
      $('#ticket').html(
        '<div class="ticket-id">' + esc(b.Booking_ID) + '</div>' +
        '<div>' + esc(b.Passenger_Name) + ', seat <strong>' + esc(b.Seat_Number) + '</strong></div>' +
        '<div>' + esc(state.bus.Route) + ' on ' + prettyDate(b.Travel_Date) + '</div>' +
        '<div>' + esc(b.Boarding_Point) + ' to ' + esc(b.Destination) + '</div>' +
        '<div class="fw-semibold">' + money(b.Fare) + '</div>'
      ).hide().removeClass('d-none').slideDown(250); // jQuery #3
      state.seat = null;
      $form[0].reset();
      $('#Boarding_Point').val(state.bus.Departure);
      loadSeats();
      Api.buses.byId(state.bus.Bus_ID).done((bus) => { state.bus = bus; });
      state.bookingList = [];
    }).fail(function (err) { fail(err); loadSeats(); });
  });

  // ---------- update / cancel bookings ----------
  const editBookingModal = new bootstrap.Modal('#bookingModal');

  $(document).on('click', '.btn-edit-booking', function () {
    const b = $(this).closest('tr').data('booking');
    $('#eb_title').text(b.Booking_ID);
    $('#eb_id').val(b.Booking_ID);
    $.each(['Passenger_Name', 'Phone', 'Email', 'Boarding_Point', 'Seat_Number'], (_, k) => $('#eb_' + k).val(b[k]));
    $('#editBookingForm .is-invalid').removeClass('is-invalid');
    editBookingModal.show();
  });

  $('#editBookingForm').on('submit', function (e) {
    e.preventDefault();
    if (!validate($(this))) return;
    const data = formData($(this));
    const id = data.Booking_ID;
    delete data.Booking_ID;
    Api.bookings.update(id, data).done(function () {
      editBookingModal.hide();
      notify('Booking ' + id + ' updated');
      runBookingSearch();
    }).fail(fail);
  });

  $(document).on('click', '.btn-cancel-booking', function () {
    const b = $(this).closest('tr').data('booking');
    if (!confirm('Cancel booking ' + b.Booking_ID + ' for ' + b.Passenger_Name + '? The seat will be released.')) return;
    Api.bookings.cancel(b.Booking_ID).done(function () {
      notify('Booking ' + b.Booking_ID + ' cancelled');
      runBookingSearch();
    }).fail(fail);
  });

  // ---------- manage buses (admin) ----------
  function loadAdminBuses() {
    Api.buses.all().done((buses) => renderBuses($('#adminBusTable'), buses, true)).fail(fail);
  }

  // jQuery #3: slide the add-bus form open and closed
  $('#toggleAddBus').on('click', function () { $('#addBusPanel').slideToggle(200); });

  // Route Management: suggest "Departure - Destination" while typing
  $('#a_Departure, #a_Destination').on('keyup', function () {
    const d = $.trim($('#a_Departure').val()), t = $.trim($('#a_Destination').val());
    const $route = $('#a_Route');
    if (!$route.data('touched')) $route.val(d && t ? d + ' - ' + t : '');
  });
  $('#a_Route').on('input', function () { $(this).data('touched', true); });

  $('#addBusForm').on('submit', function (e) {
    e.preventDefault();
    const $form = $(this);
    if (!validate($form)) return;
    const data = formData($form);
    if (!data.Bus_ID) delete data.Bus_ID;
    Api.buses.create(data).done(function (bus) {
      notify('Bus ' + bus.Bus_ID + ' added');
      $form[0].reset();
      $('#a_Route').removeData('touched');
      $('#addBusPanel').slideUp(200);
      loadAdminBuses();
    }).fail(fail);
  });

  const busModal = new bootstrap.Modal('#busModal');

  $(document).on('click', '.btn-edit-bus', function () {
    const b = $(this).closest('tr').data('bus');
    $('#eb_bus_title').text(b.Bus_ID);
    $('#ed_Bus_ID, #es_Bus_ID').val(b.Bus_ID);
    $.each(['Bus_Name', 'Total_Seats', 'Fare', 'Route', 'Departure', 'Destination'], (_, k) => $('#ed_' + k).val(b[k]));
    $.each(['Travel_Date', 'Departure_Time', 'Arrival_Time'], (_, k) => $('#es_' + k).val(b[k]));
    $('#busModal .is-invalid').removeClass('is-invalid');
    busModal.show();
  });

  $('#busDetailsForm').on('submit', function (e) {
    e.preventDefault();
    if (!validate($(this))) return;
    const data = formData($(this));
    const id = data.Bus_ID;
    delete data.Bus_ID;
    Api.buses.updateDetails(id, data).done(function () {
      notify('Details for ' + id + ' saved');
      loadAdminBuses();
    }).fail(fail);
  });

  $('#busScheduleForm').on('submit', function (e) {
    e.preventDefault();
    if (!validate($(this))) return;
    const data = formData($(this));
    const id = data.Bus_ID;
    delete data.Bus_ID;
    Api.buses.updateSchedule(id, data).done(function () {
      notify('Schedule for ' + id + ' saved');
      loadAdminBuses();
    }).fail(fail);
  });

  $(document).on('click', '.btn-delete-bus', function () {
    const b = $(this).closest('tr').data('bus');
    if (!confirm('Delete bus ' + b.Bus_ID + ' (' + b.Route + ')?')) return;
    Api.buses.remove(b.Bus_ID).done(function () {
      notify('Bus ' + b.Bus_ID + ' deleted');
      loadAdminBuses();
    }).fail(function (err) {
      if (err.status === 409 && confirm(err.message + '\n\nDelete anyway and cancel those bookings?')) {
        Api.buses.remove(b.Bus_ID, true).done(function (r) {
          notify('Bus deleted, ' + r.cancelled_bookings + ' booking(s) cancelled');
          loadAdminBuses();
        }).fail(fail);
      } else if (err.status !== 409) fail(err);
    });
  });

  // ---------- start ----------
  bindSearchControls(BUS_SEARCHES, $('#busSearchType'), $('#busSearchValue'));
  bindSearchControls(BOOKING_SEARCHES, $('#bookingSearchType'), $('#bookingSearchValue'));
  runBusSearch();
});
