(function () {
  'use strict';

  /** Display positions are invented demo coordinates, never geocoded addresses. */
  window.createPropertyMap = function (options) {
    const { elementId, statusId, rows = [], onSelect = function () {}, config = {} } = options;
    const container = document.getElementById(elementId);
    const status = document.getElementById(statusId);
    const setStatus = function (message) { if (status) status.textContent = message; };
    const noop = { update: function () {}, fit: function () {}, refresh: function () {}, resize: function () {} };

    if (!container || !window.L) {
      if (container) container.classList.add('property-map-unavailable');
      setStatus('The street map could not load. The property list and recorded issues remain available.');
      return noop;
    }

    const L = window.L;
    const map = L.map(container, {
      scrollWheelZoom: false,
      keyboard: true,
      zoomControl: true,
      attributionControl: true
    });
    const markers = new Map();
    const sourceRows = new Map(rows.map(function (row) { return [String(row.case_id), row]; }));
    let visibleRows = [];
    let selectedId = null;
    let missingPositions = 0;
    let tileErrors = 0;
    let initialFitDone = false;
    let resizeObserver;
    const keyboardTargets = new WeakSet();

    const tileUrl = config.tile_url || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: config.attribution || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
    });

    function locationFor(row) {
      const location = row && row.display_location;
      if (!location || location.kind !== 'demo') return null;
      const lat = location.latitude;
      const lng = location.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < -85.05112878 || lat > 85.05112878 || lng < -180 || lng > 180) return null;
      return [lat, lng];
    }

    function describeStatus() {
      if (!visibleRows.length) {
        setStatus(missingPositions
          ? 'No matching properties have demo positions. The property list remains available.'
          : 'No matching properties to show. Change the search or filter to see demo pins.');
        return;
      }
      const count = visibleRows.length;
      let message = count + ' demo ' + (count === 1 ? 'pin' : 'pins') + '. Invented positions; actual property locations are unknown.';
      if (missingPositions) message += ' ' + missingPositions + ' matching ' + (missingPositions === 1 ? 'record has' : 'records have') + ' no valid demo position.';
      if (tileErrors) message += ' Some street tiles could not load; pins and property details remain available.';
      setStatus(message);
    }

    function textElement(tag, className, value) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      return element;
    }

    function popupFor(row) {
      const popup = document.createElement('section');
      popup.className = 'property-map-popup';
      popup.append(textElement('h3', 'property-map-popup-heading', 'CASE ' + row.case_id));
      popup.append(textElement('p', 'property-map-popup-address', row.property));
      popup.append(textElement('p', 'property-map-popup-scope', 'Demo location only. Actual property location unknown.'));
      const button = textElement('button', 'property-map-popup-button', 'View property');
      button.type = 'button';
      button.addEventListener('click', function () { onSelect(String(row.case_id)); });
      popup.append(button);
      return popup;
    }

    function paintSelection(marker, id) {
      const element = marker.getElement();
      if (!element) return;
      const selected = id === selectedId;
      element.classList.toggle('property-map-pin-selected', selected);
      element.setAttribute('role', 'button');
      element.setAttribute('aria-pressed', String(selected));
      element.setAttribute('aria-label', 'Demo pin, case ' + id + (selected ? ', selected' : '') + '. View property.');
      marker.setZIndexOffset(selected ? 1000 : 0);
    }

    function addSpaceActivation(marker) {
      const element = marker.getElement();
      if (!element || keyboardTargets.has(element)) return;
      keyboardTargets.add(element);
      let spacePressed = false;
      element.addEventListener('keydown', function (event) {
        if (event.key !== ' ' && event.code !== 'Space') return;
        event.preventDefault();
        event.stopPropagation();
        spacePressed = true;
      });
      element.addEventListener('keyup', function (event) {
        if (event.key !== ' ' && event.code !== 'Space') return;
        event.preventDefault();
        event.stopPropagation();
        if (!spacePressed) return;
        spacePressed = false;
        marker.fire('click', { originalEvent: event });
      });
      element.addEventListener('blur', function () { spacePressed = false; });
    }

    function markerFor(row) {
      const id = String(row.case_id);
      if (markers.has(id)) return markers.get(id);
      const number = textElement('span', 'property-map-pin-number', id);
      const marker = L.marker(locationFor(row), {
        keyboard: true,
        title: 'Demo location, case ' + id + '. Actual property location unknown.',
        riseOnHover: true,
        icon: L.divIcon({ className: 'property-map-pin', html: number, iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -44] })
      });
      marker.bindPopup(popupFor(row), {
        maxWidth: 250,
        minWidth: 190,
        maxHeight: 220,
        className: 'property-map-popup-shell',
        autoPan: true,
        autoPanPadding: [14, 14]
      });
      marker.on('click', function () { onSelect(id); });
      // Leaflet opens the popup on Enter without firing a click. Select once here.
      marker.on('keypress', function (event) {
        const original = event.originalEvent;
        if (original && (original.key === 'Enter' || original.keyCode === 13)) onSelect(id);
      });
      marker.on('add', function () { paintSelection(marker, id); addSpaceActivation(marker); });
      markers.set(id, marker);
      return marker;
    }

    function refresh() {
      // Hidden views have no usable dimensions; the caller can refresh after showing them.
      if (!container.isConnected || !container.clientWidth || !container.clientHeight) return false;
      map.invalidateSize({ pan: false });
      return true;
    }

    function fit() {
      const positions = visibleRows.map(locationFor).filter(Boolean);
      if (!positions.length || !refresh()) return false;
      map.fitBounds(L.latLngBounds(positions), { padding: [32, 32], maxZoom: 13, animate: false });
      initialFitDone = true;
      return true;
    }

    function update(shownRows, nextSelectedId, updateOptions = {}) {
      selectedId = nextSelectedId == null ? null : String(nextSelectedId);
      const requested = Array.isArray(shownRows) ? shownRows : [];
      const seen = new Set();
      visibleRows = [];
      missingPositions = 0;
      requested.forEach(function (row) {
        const id = String(row.case_id);
        if (seen.has(id)) return;
        seen.add(id);
        const source = sourceRows.get(id) || row;
        if (locationFor(source)) visibleRows.push(source);
        else missingPositions += 1;
      });
      const visibleIds = new Set(visibleRows.map(function (row) { return String(row.case_id); }));
      markers.forEach(function (marker, id) {
        if ((!visibleIds.has(id) || id !== selectedId) && marker.isPopupOpen()) marker.closePopup();
        if (!visibleIds.has(id) && map.hasLayer(marker)) map.removeLayer(marker);
      });
      visibleRows.forEach(function (row) {
        const id = String(row.case_id);
        const marker = markerFor(row);
        if (!map.hasLayer(marker)) marker.addTo(map);
        paintSelection(marker, id);
      });
      if (!visibleRows.length) map.closePopup();
      describeStatus();
      if ((!initialFitDone || updateOptions.fit) && visibleRows.length) fit();
    }

    tiles.on('tileerror', function () { tileErrors += 1; describeStatus(); });
    tiles.addTo(map);
    update(rows, null);
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function () {
        if (!initialFitDone && visibleRows.length) fit();
        else refresh();
      });
      resizeObserver.observe(container);
      map.on('unload', function () { resizeObserver.disconnect(); });
    }
    return { update: update, fit: fit, refresh: refresh, resize: refresh };
  };
}());
