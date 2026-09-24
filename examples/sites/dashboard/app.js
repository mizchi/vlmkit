/* Keel Analytics — Overview behaviour. Classic script (works from file://); reads window.KEEL_DATA.
 * Deterministic: no clock, no randomness. The calendar is walked back from the data's fixed end date. */
(function () {
  'use strict';

  var D = window.KEEL_DATA;
  var root = document.documentElement;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MINUS = '−';
  var EN_DASH = '–';
  var PER_PAGE = 6;

  var fmtInt = new Intl.NumberFormat('en-US');
  var fmtMoney0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmtMoney2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ---------- calendar: index 0 … days-1, the last one is Tue 22 Sep 2026 ---------- */
  var CAL = (function () {
    var parts = D.endDate.split('-');
    var y = +parts[0], m = +parts[1] - 1, d = +parts[2], w = 2; /* 2026-09-22 is a Tuesday */
    var MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var out = new Array(D.days);
    for (var i = D.days - 1; i >= 0; i--) {
      out[i] = { y: y, m: m, d: d, w: w };
      d -= 1; w = (w + 6) % 7;
      if (d === 0) { m -= 1; if (m < 0) { m = 11; y -= 1; } d = MLEN[m]; }
    }
    return out;
  })();
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function shortDay(i) { var t = CAL[i]; return MONTHS[t.m] + ' ' + t.d; }
  function longDay(i) { var t = CAL[i]; return WEEKDAYS[t.w] + ', ' + MONTHS[t.m] + ' ' + t.d; }
  function isoDay(i) { var t = CAL[i]; return t.y + '-' + pad2(t.m + 1) + '-' + pad2(t.d); }
  function span(a, b, withYear) { return shortDay(a) + ' ' + EN_DASH + ' ' + shortDay(b) + (withYear ? ', ' + CAL[b].y : ''); }

  /* ---------- one range: totals, previous period, daily series ---------- */
  function rangeData(n) {
    var e = D.days, s = e - n, ps = s - n;
    function totals(a, b) {
      var v = 0, o = 0, r = 0;
      for (var i = a; i < b; i++) { v += D.visitors[i]; o += D.orders[i]; r += D.revenue[i]; }
      return { visitors: v, orders: o, revenue: r, conversion: o / v, aov: r / o };
    }
    var series = { visitors: [], conversion: [], revenue: [], aov: [] }, prevVisitors = [];
    for (var i = s; i < e; i++) {
      series.visitors.push(D.visitors[i]);
      series.conversion.push(D.orders[i] / D.visitors[i]);
      series.revenue.push(D.revenue[i]);
      series.aov.push(D.revenue[i] / D.orders[i]);
      prevVisitors.push(D.visitors[i - n]);
    }
    return { n: n, s: s, e: e, ps: ps, cur: totals(s, e), prev: totals(ps, s), series: series, prevVisitors: prevVisitors };
  }

  var state = { range: 30, sortKey: 'at', sortDir: 'descending', page: 1, active: 29 };
  var RD = rangeData(state.range);

  /* ---------- KPI cards ---------- */
  var KPIS = {
    visitors: function (v) { return fmtInt.format(v); },
    conversion: function (v) { return (v * 100).toFixed(2) + '%'; },
    revenue: function (v) { return fmtMoney0.format(v); },
    aov: function (v) { return fmtMoney2.format(v); }
  };
  var ARROW_UP = '<svg class="delta-arrow" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 10V2.25M2.75 5.5L6 2.25 9.25 5.5"/></svg>';
  var ARROW_DOWN = '<svg class="delta-arrow" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M6 2v7.75M2.75 6.5L6 9.75 9.25 6.5"/></svg>';

  function smooth(a, w) {
    if (w <= 1) return a.slice();
    var h = Math.floor(w / 2), out = [];
    for (var i = 0; i < a.length; i++) {
      var t = 0, c = 0;
      for (var j = Math.max(0, i - h); j <= Math.min(a.length - 1, i + h); j++) { t += a[j]; c++; }
      out.push(t / c);
    }
    return out;
  }

  function renderSpark(svg, values) {
    var w = Math.max(40, Math.round(svg.getBoundingClientRect().width)), h = 36, p = 3;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), n = values.length;
    var extent = max - min || 1;
    function X(i) { return p + (i * (w - 2 * p)) / (n - 1); }
    function Y(v) { return p + (h - 2 * p) * (1 - (v - min) / extent); }
    var d = '';
    for (var i = 0; i < n; i++) d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(values[i]).toFixed(1);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML =
      '<path class="spark-area" d="' + d + 'L' + X(n - 1).toFixed(1) + ' ' + h + 'L' + X(0).toFixed(1) + ' ' + h + 'Z"/>' +
      '<path class="spark-line" d="' + d + '"/>' +
      '<circle class="spark-end" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(values[n - 1]).toFixed(1) + '" r="2.5"/>';
  }

  function renderKpis() {
    var win = RD.n >= 90 ? 7 : RD.n >= 30 ? 3 : 1;
    $all('.kpi').forEach(function (card) {
      var key = card.getAttribute('data-kpi');
      var cur = RD.cur[key], prev = RD.prev[key];
      var pct = ((cur - prev) / prev) * 100;
      var up = pct >= 0;
      $('.kpi-value', card).textContent = KPIS[key](cur);
      var delta = $('.delta', card);
      delta.className = 'delta ' + (up ? 'delta--up' : 'delta--down');
      delta.innerHTML = (up ? ARROW_UP : ARROW_DOWN) + '<span>' + (up ? '+' : MINUS) + Math.abs(pct).toFixed(1) + '%</span>';
      $('.delta-ctx', card).textContent = 'vs previous ' + RD.n + ' days';
      renderSpark($('.spark', card), smooth(RD.series[key], win));
    });
  }

  /* ---------- main chart ---------- */
  var chartBox = $('#chart'), svg = $('#chart-svg'), tip = $('#chart-tip');
  var G = null; /* geometry of the last render */

  function niceStep(rough) {
    var mag = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * mag >= rough) return steps[i] * mag;
    return 10 * mag;
  }
  function compact(v) { return v >= 1000 ? (v / 1000).toString().replace(/\.0$/, '') + 'k' : String(v); }
  function pickXStep(n, pw) {
    var per = pw / Math.max(1, n - 1), opts = [1, 2, 7, 14, 30];
    for (var i = 0; i < opts.length; i++) if (opts[i] * per >= 64) return opts[i];
    return 30;
  }
  function pointLabel(i) {
    return longDay(RD.s + i) + ': ' + fmtInt.format(RD.series.visitors[i]) + ' visitors. Previous period, ' +
      shortDay(RD.ps + i) + ': ' + fmtInt.format(RD.prevVisitors[i]) + '.';
  }

  function renderChart() {
    var W = Math.max(240, Math.round(chartBox.clientWidth)), H = Math.round(chartBox.clientHeight);
    var P = { t: 8, r: 8, b: 28, l: 40 };
    var pw = W - P.l - P.r, ph = H - P.t - P.b;
    var cur = RD.series.visitors, prev = RD.prevVisitors, n = cur.length;
    var max = Math.max(Math.max.apply(null, cur), Math.max.apply(null, prev));
    var step = niceStep(max / 5), yMax = Math.ceil(max / step) * step;
    function X(i) { return P.l + (n > 1 ? (i * pw) / (n - 1) : pw / 2); }
    function Y(v) { return P.t + ph - (v / yMax) * ph; }
    G = { W: W, H: H, P: P, pw: pw, ph: ph, n: n, X: X, Y: Y };
    if (state.active >= n) state.active = n - 1;

    var hadFocus = svg.contains(document.activeElement);
    var out = ['<defs><linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" class="c-area-top"/><stop offset="1" class="c-area-bottom"/></linearGradient></defs>'];

    out.push('<g aria-hidden="true">');
    for (var v = 0; v <= yMax + 0.5; v += step) {
      var gy = Math.round(Y(v)) + 0.5;
      out.push('<line class="' + (v === 0 ? 'c-base' : 'c-grid') + '" x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + gy + '" y2="' + gy + '"/>');
      out.push('<text class="c-label" x="' + (P.l - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + compact(v) + '</text>');
    }
    var xs = pickXStep(n, pw);
    for (var i = 0; i < n; i += xs) {
      var x = X(i), anchor = i === 0 ? 'start' : x > W - P.r - 28 ? 'end' : 'middle';
      out.push('<text class="c-label" x="' + x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + shortDay(RD.s + i) + '</text>');
    }
    var dCur = '', dPrev = '';
    for (i = 0; i < n; i++) {
      dCur += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(cur[i]).toFixed(1);
      dPrev += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(prev[i]).toFixed(1);
    }
    out.push('<path class="c-prev" d="' + dPrev + '"/>');
    out.push('<path class="c-area" d="' + dCur + 'L' + X(n - 1).toFixed(1) + ' ' + Y(0) + 'L' + X(0).toFixed(1) + ' ' + Y(0) + 'Z"/>');
    out.push('<path class="c-cur" d="' + dCur + '"/>');
    out.push('<line class="c-cross" id="chart-cross" x1="0" x2="0" y1="' + P.t + '" y2="' + (P.t + ph) + '" visibility="hidden"/>');
    out.push('</g>');
    out.push('<rect class="c-hit" x="' + P.l + '" y="' + P.t + '" width="' + pw + '" height="' + ph + '" aria-hidden="true"/>');
    out.push('<g class="c-points">');
    for (i = 0; i < n; i++) {
      out.push('<circle class="c-pt' + (i === n - 1 ? ' is-end' : '') + '" data-i="' + i + '" cx="' + X(i).toFixed(1) +
        '" cy="' + Y(cur[i]).toFixed(1) + '" r="4" tabindex="' + (i === state.active ? '0' : '-1') +
        '" role="img" aria-label="' + esc(pointLabel(i)) + '"/>');
    }
    out.push('</g>');

    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', 'Daily visitors, ' + span(RD.s, RD.e - 1, true) +
      ', against the previous ' + RD.n + ' days. Use the arrow keys to move between days.');
    svg.innerHTML = out.join('');

    if (hadFocus) { focusPoint(state.active); } else if (!tip.hidden) { showTip(state.active, false); }
  }

  function pointEl(i) { return $('.c-pt[data-i="' + i + '"]', svg); }

  function showTip(i, fromKeyboard) {
    if (!G) return;
    state.active = i;
    $all('.c-pt', svg).forEach(function (c) {
      var on = +c.getAttribute('data-i') === i;
      c.classList.toggle('is-active', on);
      c.setAttribute('tabindex', on ? '0' : '-1');
    });
    var cur = RD.series.visitors[i], prev = RD.prevVisitors[i];
    tip.innerHTML =
      '<p class="tip-date">' + longDay(RD.s + i) + '</p>' +
      '<p class="tip-row"><span class="tip-key"><i class="tip-swatch"></i>This period</span><span class="tip-val">' + fmtInt.format(cur) + '</span></p>' +
      '<p class="tip-row"><span class="tip-key"><i class="tip-swatch tip-swatch--prev"></i>' + shortDay(RD.ps + i) + '</span><span class="tip-val">' + fmtInt.format(prev) + '</span></p>' +
      (fromKeyboard ? '<p class="tip-hint"><kbd>\u2190</kbd> <kbd>\u2192</kbd> day \u00b7 <kbd>Home</kbd> <kbd>End</kbd></p>' : '');
    tip.hidden = false;
    var x = G.X(i), y = G.Y(cur);
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = x + 16;
    if (left + tw > G.W) left = x - 16 - tw;
    var top = Math.max(0, Math.min(y - th / 2, G.P.t + G.ph - th));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    var cross = $('#chart-cross', svg);
    cross.setAttribute('x1', x.toFixed(1));
    cross.setAttribute('x2', x.toFixed(1));
    cross.setAttribute('visibility', 'visible');
  }

  function hideTip() {
    tip.hidden = true;
    var cross = $('#chart-cross', svg);
    if (cross) cross.setAttribute('visibility', 'hidden');
    $all('.c-pt.is-active', svg).forEach(function (c) { c.classList.remove('is-active'); });
  }

  function focusPoint(i) {
    var el = pointEl(i);
    if (!el) return;
    showTip(i, true);
    el.focus();
  }

  function indexAt(clientX) {
    var r = svg.getBoundingClientRect();
    var t = (clientX - r.left - G.P.l) / G.pw;
    return Math.max(0, Math.min(G.n - 1, Math.round(t * (G.n - 1))));
  }

  /* Listeners live on the HTML wrapper, not on the <svg>: Chromium makes an SVG element with
     focus listeners focusable, which put a blank extra Tab stop in front of the chart. */
  chartBox.addEventListener('pointermove', function (e) { if (G) showTip(indexAt(e.clientX), svg.contains(document.activeElement)); });
  chartBox.addEventListener('pointerdown', function (e) { if (G) showTip(indexAt(e.clientX)); });
  chartBox.addEventListener('pointerleave', function (e) {
    /* A lifted finger also "leaves": keep the tapped day on screen until the next tap elsewhere. */
    if (e.pointerType === 'touch') return;
    if (svg.contains(document.activeElement)) showTip(state.active, true); else hideTip();
  });
  document.addEventListener('pointerdown', function (e) {
    if (!tip.hidden && !chartBox.contains(e.target) && !svg.contains(document.activeElement)) hideTip();
  });
  chartBox.addEventListener('focusin', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-i');
    if (i !== null && i !== undefined) showTip(+i, true);
  });
  chartBox.addEventListener('focusout', function (e) {
    if (!svg.contains(e.relatedTarget)) hideTip();
  });
  chartBox.addEventListener('keydown', function (e) {
    var i = e.target.getAttribute && e.target.getAttribute('data-i');
    if (i === null || i === undefined || !G) return;
    i = +i;
    var next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(G.n - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = G.n - 1;
    else if (e.key === 'PageUp') next = Math.min(G.n - 1, i + 7);
    else if (e.key === 'PageDown') next = Math.max(0, i - 7);
    else if (e.key === 'Escape') { hideTip(); return; }
    if (next === null) return;
    e.preventDefault();
    focusPoint(next);
  });

  /* ---------- top channels ---------- */
  var channelsList = $('#channels');
  (function buildChannels() {
    channelsList.innerHTML = D.channels.names.map(function (name) {
      return '<li class="channel">' +
        '<div class="channel-row"><span class="channel-name">' + name + '</span>' +
        '<span class="channel-value"></span><span class="channel-pct"></span></div>' +
        '<div class="channel-track" aria-hidden="true"><div class="channel-bar"></div></div></li>';
    }).join('');
  })();

  function renderChannels() {
    var shares = D.channels[RD.n], total = RD.cur.visitors;
    var values = shares.map(function (s) { return Math.round(total * s); });
    var drift = total - values.reduce(function (a, b) { return a + b; }, 0);
    values[0] += drift; /* keep the parts summing to the total */
    var max = Math.max.apply(null, values);
    $all('.channel', channelsList).forEach(function (li, i) {
      $('.channel-value', li).textContent = fmtInt.format(values[i]);
      $('.channel-pct', li).textContent = ((values[i] / total) * 100).toFixed(1) + '%';
      $('.channel-bar', li).style.width = ((values[i] / max) * 100).toFixed(2) + '%';
    });
    $('#channels-total').textContent = fmtInt.format(total);
  }

  /* ---------- range ---------- */
  function renderRange() {
    RD = rangeData(state.range);
    state.active = RD.n - 1;
    $('#range-label').textContent = 'Last ' + RD.n + ' days';
    $('#range-dates').textContent = span(RD.s, RD.e - 1, true);
    $('#chart-sub').textContent = span(RD.s, RD.e - 1) + ' against ' + span(RD.ps, RD.s - 1);
    renderKpis();
    renderChart();
    renderChannels();
  }

  $('#range').addEventListener('change', function (e) {
    if (e.target.name !== 'range') return;
    state.range = +e.target.value;
    hideTip();
    renderRange();
    announce('Showing the last ' + state.range + ' days');
  });

  /* ---------- recent orders ---------- */
  var tbody = $('#orders-body'), scroller = $('#orders-scroll'), frame = $('#orders-frame');

  function fmtAt(at) { return MONTHS[+at.slice(5, 7) - 1] + ' ' + (+at.slice(8, 10)) + ', ' + at.slice(11, 16); }

  function sortedOrders() {
    var k = state.sortKey, dir = state.sortDir === 'ascending' ? 1 : -1;
    return D.orderRows.slice().sort(function (a, b) {
      var x = a[k], y = b[k];
      var c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'en');
      if (c !== 0) return c * dir;
      return a.at < b.at ? 1 : a.at > b.at ? -1 : 0;
    });
  }

  function rowHtml(o) {
    return '<tr>' +
      '<th scope="row" class="col-id">#' + o.id + '</th>' +
      '<td>' + esc(o.customer) + '</td>' +
      '<td class="cell-date">' + fmtAt(o.at) + '</td>' +
      '<td class="cell-channel">' + o.channel + '</td>' +
      '<td><span class="badge badge--' + o.status.toLowerCase() + '">' + o.status + '</span></td>' +
      '<td class="num cell-amount">' + fmtMoney2.format(o.amount) + '</td>' +
      '</tr>';
  }

  /* Column widths come from ALL twelve orders, not the six on screen: measure the natural width of
     every column once, pin it on the header cell, and paging or sorting can no longer move a column.
     Re-run when the scroller resizes (the cell padding changes with the card's width). */
  var orderTable = $('.orders');
  function lockColumns() {
    var ths = $all('thead th', orderTable);
    ths.forEach(function (th) { th.style.width = ''; });
    orderTable.style.width = 'auto';
    tbody.innerHTML = D.orderRows.map(rowHtml).join('');
    var widths = ths.map(function (th) { return Math.ceil(th.getBoundingClientRect().width); });
    orderTable.style.width = '';
    ths.forEach(function (th, i) { th.style.width = widths[i] + 'px'; });
  }

  function renderOrders() {
    var rows = sortedOrders(), pages = Math.ceil(rows.length / PER_PAGE);
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * PER_PAGE, pageRows = rows.slice(start, start + PER_PAGE);
    tbody.innerHTML = pageRows.map(rowHtml).join('');
    $('#orders-status').textContent = 'Showing ' + (start + 1) + EN_DASH + (start + pageRows.length) + ' of ' + rows.length + ' orders';

    $all('.orders thead th').forEach(function (th) {
      var b = $('.sort', th);
      if (b.getAttribute('data-key') === state.sortKey) th.setAttribute('aria-sort', state.sortDir);
      else th.removeAttribute('aria-sort');
    });
    $all('.pager-btn').forEach(function (b) {
      var p = b.getAttribute('data-page');
      if (p === 'prev') b.setAttribute('aria-disabled', String(state.page === 1));
      else if (p === 'next') b.setAttribute('aria-disabled', String(state.page === pages));
      else if (+p === state.page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    syncScroller();
  }

  $('.orders thead').addEventListener('click', function (e) {
    var b = e.target.closest('.sort');
    if (!b) return;
    var k = b.getAttribute('data-key');
    if (state.sortKey === k) state.sortDir = state.sortDir === 'ascending' ? 'descending' : 'ascending';
    else { state.sortKey = k; state.sortDir = 'ascending'; }
    state.page = 1;
    renderOrders();
    announce('Sorted by ' + b.textContent.trim() + ', ' + state.sortDir);
  });

  $('.pager').addEventListener('click', function (e) {
    var b = e.target.closest('.pager-btn');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    var p = b.getAttribute('data-page'), pages = Math.ceil(D.orderRows.length / PER_PAGE);
    var next = p === 'prev' ? state.page - 1 : p === 'next' ? state.page + 1 : +p;
    if (next < 1 || next > pages || next === state.page) return;
    state.page = next;
    renderOrders();
  });

  function syncScroller() {
    var scrolls = scroller.scrollWidth > scroller.clientWidth + 1;
    if (scrolls) {
      scroller.setAttribute('role', 'region');
      scroller.setAttribute('aria-label', 'Orders table, scrolls sideways');
      scroller.setAttribute('tabindex', '0');
    } else {
      scroller.removeAttribute('role');
      scroller.removeAttribute('aria-label');
      scroller.removeAttribute('tabindex');
    }
    scroller.classList.toggle('can-scroll', scrolls);
    scroller.classList.toggle('is-scrolled', scrolls && scroller.scrollLeft > 0);
    frame.classList.toggle('can-scroll-right', scrolls && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
  }
  scroller.addEventListener('scroll', syncScroller, { passive: true });

  /* ---------- sidebar ---------- */
  var toggle = $('#sidebar-toggle');
  var wide = window.matchMedia('(min-width: 1280px)');
  function setSidebar(s) {
    root.setAttribute('data-sidebar', s);
    var expanded = s === 'expanded';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? 'Collapse sidebar' : 'Expand sidebar');
    $('.sidebar-toggle-label', toggle).textContent = expanded ? 'Collapse' : 'Expand';
  }
  setSidebar(root.getAttribute('data-sidebar') || (wide.matches ? 'expanded' : 'collapsed'));
  toggle.addEventListener('click', function () {
    setSidebar(root.getAttribute('data-sidebar') === 'collapsed' ? 'expanded' : 'collapsed');
  });
  var onWide = function (e) { setSidebar(e.matches ? 'expanded' : 'collapsed'); };
  if (wide.addEventListener) wide.addEventListener('change', onWide); else wide.addListener(onWide);

  /* ---------- user menu (APG menu button) ---------- */
  var userBtn = $('#user-button'), menu = $('#user-menu'), panel = $('#user-menu-panel'), themeItem = $('#theme-item');
  function menuItems() { return $all('[role^="menuitem"]', menu); }
  function openMenu(index) {
    panel.hidden = false;
    userBtn.setAttribute('aria-expanded', 'true');
    var items = menuItems();
    items[index < 0 ? items.length - 1 : index].focus();
  }
  function closeMenu(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    userBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) userBtn.focus();
  }
  userBtn.addEventListener('click', function () { if (panel.hidden) openMenu(0); else closeMenu(true); });
  userBtn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openMenu(-1); }
  });
  menu.addEventListener('keydown', function (e) {
    var items = menuItems(), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'Tab') { closeMenu(false); }
  });
  menu.addEventListener('click', function (e) {
    var item = e.target.closest('[role^="menuitem"]');
    if (!item) return;
    if (item === themeItem) { setTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); return; }
    closeMenu(true);
    showToast(item.getAttribute('data-demo') + ' is outside this demo: only the Overview screen is built.');
  });
  document.addEventListener('pointerdown', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && !userBtn.contains(e.target)) closeMenu(false);
  });

  function setTheme(t) {
    root.setAttribute('data-theme', t);
    themeItem.setAttribute('aria-checked', String(t === 'light'));
  }
  themeItem.setAttribute('aria-checked', String(root.getAttribute('data-theme') === 'light'));

  /* ---------- nav items that are not part of the demo ---------- */
  $all('.nav-link[data-demo]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showToast(a.getAttribute('data-demo') + ' is outside this demo: only the Overview screen is built.');
    });
  });

  /* ---------- export ---------- */
  $('#export').addEventListener('click', function () {
    var lines = ['date,visitors,previous_period_visitors,orders,revenue_usd'];
    for (var i = RD.s; i < RD.e; i++) {
      lines.push([isoDay(i), D.visitors[i], D.visitors[i - RD.n], D.orders[i], D.revenue[i].toFixed(2)].join(','));
    }
    var name = 'keel-overview-last-' + RD.n + '-days.csv';
    try {
      var url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }));
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      showToast('Exported ' + name + ' (' + RD.n + ' days).');
    } catch (err) {
      showToast('Export failed: ' + err.message);
    }
  });

  /* ---------- toast + announcements ---------- */
  var toastEl = $('#toast'), toastTimer = 0;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-on');
      toastTimer = setTimeout(function () { toastEl.textContent = ''; }, 200);
    }, 4000);
  }
  var announcer = $('#announcer');
  function announce(msg) { announcer.textContent = ''; setTimeout(function () { announcer.textContent = msg; }, 50); }

  /* ---------- first render + keep charts at their real pixel width ---------- */
  renderRange();
  lockColumns();
  renderOrders();

  if (window.ResizeObserver) {
    var queued = false;
    var ro = new ResizeObserver(function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; renderChart(); renderKpis(); lockColumns(); renderOrders(); });
    });
    ro.observe(chartBox);
    ro.observe(scroller);
    $all('.kpi').forEach(function (k) { ro.observe(k); });
  } else {
    window.addEventListener('resize', function () { renderChart(); renderKpis(); lockColumns(); renderOrders(); });
  }
})();
