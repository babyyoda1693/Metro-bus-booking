/* AJAX layer: every call sends/receives JSON through the REST API.
 * Add a new service by adding one line here. */
const Api = (function ($) {
  const enc = encodeURIComponent;

  function request(method, url, data) {
    return $.ajax({
      url: '/api' + url,
      method: method,
      contentType: 'application/json',
      dataType: 'json',
      data: data ? JSON.stringify(data) : undefined,
    }).then(
      (res) => res,
      (xhr) => $.Deferred().reject({
        status: xhr.status,
        message: (xhr.responseJSON && xhr.responseJSON.message) || 'Cannot reach the server',
      })
    );
  }

  return {
    buses: {
      create: (bus) => request('POST', '/buses', bus),
      all: () => request('GET', '/buses'),
      byId: (id) => request('GET', '/buses/' + enc(id)),
      byRoute: (v) => request('GET', '/buses/route/' + enc(v)),
      byDeparture: (v) => request('GET', '/buses/departure/' + enc(v)),
      byDestination: (v) => request('GET', '/buses/destination/' + enc(v)),
      byDate: (v) => request('GET', '/buses/date/' + enc(v)),
      available: () => request('GET', '/buses/available'),
      updateDetails: (id, d) => request('PUT', '/buses/' + enc(id), d),
      updateSchedule: (id, d) => request('PUT', '/buses/' + enc(id) + '/schedule', d),
      remove: (id, force) => request('DELETE', '/buses/' + enc(id) + (force ? '?force=true' : '')),
      seats: (id) => request('GET', '/buses/' + enc(id) + '/seats'),
    },
    bookings: {
      create: (b) => request('POST', '/bookings', b),
      all: () => request('GET', '/bookings'),
      byId: (id) => request('GET', '/bookings/' + enc(id)),
      byPassenger: (v) => request('GET', '/bookings/passenger/' + enc(v)),
      byPhone: (v) => request('GET', '/bookings/phone/' + enc(v)),
      byEmail: (v) => request('GET', '/bookings/email/' + enc(v)),
      byBus: (v) => request('GET', '/bookings/bus/' + enc(v)),
      byDate: (v) => request('GET', '/bookings/date/' + enc(v)),
      update: (id, d) => request('PUT', '/bookings/' + enc(id), d),
      cancel: (id) => request('DELETE', '/bookings/' + enc(id)),
    },
  };
})(jQuery);
