/* Serve React from this site instead of unpkg.com, so the page never depends on a CDN
   being up. support.js looks these URLs up in window.__resources before fetching. */
(function () {
  var R = window.__resources || (window.__resources = {});
  R['https://unpkg.com/react@18.3.1/umd/react.production.min.js'] = 'vendor/react.production.min.js';
  R['https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'] = 'vendor/react-dom.production.min.js';
})();
