/**
 * iTRUSH shared Leaflet map helper (OpenStreetMap / Carto dark tiles).
 * Depends on global `L` from Leaflet.
 */
(function (global) {
  const KAMPALA = [0.3476, 32.5825];
  const DEFAULT_ZOOM = 12;

  const COLORS = {
    truck: '#2ECC71',
    idle: '#F0A500',
    pickup: '#60A5FA',
    alert: '#E55353',
    you: '#60A5FA',
    route: '#2ECC71'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function markerIcon(kind, opts) {
    const k = kind || 'pickup';
    const color =
      k === 'truck' ? COLORS.truck :
      k === 'idle' ? COLORS.idle :
      k === 'alert' ? COLORS.alert :
      k === 'you' ? COLORS.you :
      COLORS.pickup;
    const pulse = (k === 'truck' || k === 'you') ? `<span class="itrush-marker-pulse" style="color:${color}"></span>` : '';
    const cls = [
      'itrush-marker',
      k === 'truck' || k === 'idle' ? 'is-truck' : '',
      k === 'idle' ? 'is-idle' : '',
      k === 'pickup' ? 'is-pickup' : '',
      k === 'alert' ? 'is-alert' : '',
      k === 'you' ? 'is-you' : ''
    ].filter(Boolean).join(' ');
    const size = (k === 'truck' || k === 'you' || k === 'idle') ? 22 : 18;
    return L.divIcon({
      className: 'itrush-div-icon',
      html: `<div class="${cls}" title="${esc((opts && opts.label) || '')}">${pulse}<span class="itrush-marker-dot" style="background:${color}"></span></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  function popupHtml(title, meta) {
    return `<div class="itrush-popup-title">${esc(title || '')}</div>${meta ? `<div class="itrush-popup-meta">${esc(meta)}</div>` : ''}`;
  }

  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function etaMinutes(km, speedKmh) {
    if (km == null || !isFinite(km)) return null;
    const speed = speedKmh || 25;
    return Math.max(1, Math.round((km / speed) * 60));
  }

  function create(container, options) {
    if (typeof L === 'undefined') {
      console.error('Leaflet (L) is not loaded');
      return null;
    }
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return null;

    const opts = options || {};
    const map = L.map(el, {
      zoomControl: opts.zoomControl !== false,
      attributionControl: true,
      scrollWheelZoom: opts.scrollWheelZoom !== false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    map.setView(opts.center || KAMPALA, opts.zoom || DEFAULT_ZOOM);

    const layer = L.layerGroup().addTo(map);
    const markers = new Map();
    let routeLine = null;
    let hintEl = null;

    function ensureHint() {
      if (hintEl) return hintEl;
      const wrap = el.parentElement;
      if (!wrap) return null;
      hintEl = document.createElement('div');
      hintEl.className = 'map-empty-hint';
      hintEl.hidden = true;
      wrap.appendChild(hintEl);
      return hintEl;
    }

    function setHint(text) {
      const h = ensureHint();
      if (!h) return;
      if (!text) {
        h.hidden = true;
        h.innerHTML = '';
        return;
      }
      h.hidden = false;
      h.innerHTML = text;
    }

    function clear() {
      markers.forEach((m) => layer.removeLayer(m));
      markers.clear();
      if (routeLine) {
        layer.removeLayer(routeLine);
        routeLine = null;
      }
    }

    function upsert(point) {
      if (!point || point.lat == null || point.lng == null) return null;
      const id = String(point.id || `${point.lat},${point.lng}`);
      const kind = point.kind || 'pickup';
      const latlng = [Number(point.lat), Number(point.lng)];
      let m = markers.get(id);
      if (!m) {
        m = L.marker(latlng, { icon: markerIcon(kind, { label: point.label }) });
        if (point.title || point.meta) m.bindPopup(popupHtml(point.title, point.meta));
        layer.addLayer(m);
        markers.set(id, m);
      } else {
        m.setLatLng(latlng);
        m.setIcon(markerIcon(kind, { label: point.label }));
        if (point.title || point.meta) m.bindPopup(popupHtml(point.title, point.meta));
      }
      return m;
    }

    function setPoints(points, fitOpts) {
      const ids = new Set();
      (points || []).forEach((p) => {
        if (p && p.lat != null && p.lng != null) {
          const id = String(p.id || `${p.lat},${p.lng}`);
          ids.add(id);
          upsert(p);
        }
      });
      Array.from(markers.keys()).forEach((id) => {
        if (!ids.has(id)) {
          layer.removeLayer(markers.get(id));
          markers.delete(id);
        }
      });
      if (fitOpts !== false) fit(fitOpts);
      if (!markers.size) {
        setHint('<strong>No live map points yet</strong><br/>Bookings with GPS and active trucks will appear here.');
      } else {
        setHint('');
      }
    }

    function setRoute(from, to) {
      if (routeLine) {
        layer.removeLayer(routeLine);
        routeLine = null;
      }
      if (!from || !to || from.lat == null || to.lat == null) return;
      routeLine = L.polyline(
        [[from.lat, from.lng], [to.lat, to.lng]],
        {
          color: COLORS.route,
          weight: 3,
          opacity: 0.65,
          dashArray: '8 6',
          lineCap: 'round'
        }
      );
      layer.addLayer(routeLine);
    }

    function fit(fitOpts) {
      const o = fitOpts || {};
      const latlngs = [];
      markers.forEach((m) => latlngs.push(m.getLatLng()));
      if (routeLine) latlngs.push(...routeLine.getLatLngs());
      if (!latlngs.length) {
        map.setView(KAMPALA, DEFAULT_ZOOM);
        return;
      }
      if (latlngs.length === 1) {
        map.setView(latlngs[0], o.singleZoom || 14);
        return;
      }
      map.fitBounds(L.latLngBounds(latlngs), {
        padding: o.padding || [36, 36],
        maxZoom: o.maxZoom || 15
      });
    }

    function invalidate() {
      setTimeout(() => {
        try { map.invalidateSize(); } catch (_) {}
      }, 80);
    }

    function destroy() {
      try { map.remove(); } catch (_) {}
      if (hintEl && hintEl.parentElement) hintEl.parentElement.removeChild(hintEl);
    }

    return {
      map,
      layer,
      markers,
      clear,
      upsert,
      setPoints,
      setRoute,
      fit,
      invalidate,
      setHint,
      destroy
    };
  }

  function parseGeo(geo) {
    if (!geo) return null;
    const lat = Number(geo.lat);
    const lng = Number(geo.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng };
  }

  global.ITrushMap = {
    KAMPALA,
    COLORS,
    create,
    markerIcon,
    haversineKm,
    etaMinutes,
    parseGeo,
    popupHtml
  };
})(window);
