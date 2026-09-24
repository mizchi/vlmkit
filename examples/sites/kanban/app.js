/* Sprintboard — the "Website relaunch" board.
   The board lives in memory: a reload re-seeds it, so every visit (and every gate run) starts
   from the same state. No clock is read — the board's "today" is part of the data. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ data

  var TODAY = '2026-09-23'; // a Wednesday, two days before the sprint ends

  var PEOPLE = {
    AK: { name: 'Ana Kowalski', color: '#6d28d9' },
    MR: { name: 'Marco Reyes', color: '#0e7490' },
    PN: { name: 'Priya Nair', color: '#c2410c' },
    JW: { name: 'Jonas Weber', color: '#15803d' },
    LO: { name: 'Lea Okafor', color: '#be185d' }
  };

  var LABELS = { design: 'Design', frontend: 'Frontend', backend: 'Backend', bug: 'Bug' };
  var PRIORITY = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };

  var COLUMNS = [
    { id: 'backlog', title: 'Backlog' },
    { id: 'progress', title: 'In progress', limit: 3 },
    { id: 'review', title: 'Review' },
    { id: 'done', title: 'Done' }
  ];

  function todo(text) { return { text: text, done: false }; }
  function did(text) { return { text: text, done: true }; }

  var SEED = [
    { id: 'SB-101', col: 'backlog', title: 'Audit legacy URL redirects', labels: ['backend'], assignee: 'JW', due: '2026-10-02', priority: 'medium',
      description: 'The old site has about 1,400 URLs. Export the current redirect map, flag chains longer than one hop, and list the pages that should return 410 instead of redirecting.',
      checklist: [did('Export the current redirect map'), todo('Flag redirect chains'), todo('Mark pages to retire with 410'), todo('Hand the map to review')] },
    { id: 'SB-102', col: 'backlog', title: 'Footer links 404 on /press', labels: ['bug', 'frontend'], assignee: 'PN', due: '2026-09-21', priority: 'high',
      description: 'Three footer links on the press page still point at the old /news path and return 404. Fix the links and add the old paths to the redirect map.',
      checklist: [did('Reproduce on staging'), todo('Update the footer link targets'), todo('Add the /news paths to the redirects')] },
    { id: 'SB-103', col: 'backlog', title: 'Cookie banner copy review', labels: ['design'], assignee: 'AK', due: '2026-10-06', priority: 'low',
      description: 'Legal sent revised consent wording. Fit it into the banner without a third line on phones, and keep the two buttons equal in weight.',
      checklist: [todo('Paste the revised wording'), todo('Check line length on a 320px screen')] },
    { id: 'SB-104', col: 'backlog', title: 'Newsletter signup endpoint', labels: ['backend'], assignee: 'LO', due: '2026-09-29', priority: 'medium',
      description: 'Accept an email address, send the double opt-in message and rate-limit by IP. The footer form posts here.',
      checklist: [did('Schema and validation'), todo('Double opt-in email'), todo('Rate limiting')] },
    { id: 'SB-105', col: 'backlog', title: 'Responsive images for case studies', labels: ['frontend', 'backend'], assignee: 'MR', due: null, priority: 'low',
      description: 'Case study pages ship full-size photos. Generate three widths at build time and switch the templates to srcset.',
      checklist: [todo('Pick the three widths'), todo('Add the build step'), todo('Switch the templates to srcset')] },

    { id: 'SB-106', col: 'progress', title: 'Hero copy', labels: ['design'], assignee: 'AK', due: '2026-09-25', priority: 'high',
      description: 'Three headline options for the new home page hero, each with a one-line subhead. The winner goes into the CMS before the design freeze on Friday.',
      checklist: [did('Draft three headline options'), did('Tone check against the brand guide'), todo('Legal review of product claims'), todo('Pick the winner with marketing'), todo('Enter the final copy in the CMS')] },
    { id: 'SB-107', col: 'progress', title: 'Pricing page layout', labels: ['design', 'frontend'], assignee: 'PN', due: '2026-09-24', priority: 'high',
      description: 'Three plan columns on desktop and stacked cards on phones. The comparison table becomes an accordion below 640px.',
      checklist: [did('Desktop grid'), did('Stacked cards on phones'), did('Comparison accordion'), todo('Monthly / yearly toggle'), todo('Custom plan panel'), todo('Check at 320px')] },
    { id: 'SB-108', col: 'progress', title: 'Search API pagination', labels: ['backend'], assignee: 'JW', due: '2026-09-22', priority: 'urgent',
      description: 'Results past page 10 repeat. Move the search endpoint from offset to cursor pagination and keep old page links working.',
      checklist: [did('Cursor encoding'), did('Endpoint change'), did('Keep offset links working'), did('Load test with 50k documents'), todo('Update the API docs')] },

    { id: 'SB-109', col: 'review', title: 'Navigation keyboard support', labels: ['frontend'], assignee: 'MR', due: '2026-09-23', priority: 'medium',
      description: 'The main menu opened on hover only. Each section now has a disclosure button, the arrow keys move between top-level items and Escape closes the menu.',
      checklist: [did('Disclosure buttons'), did('Arrow keys between items'), did('Escape closes and returns focus'), did('Screen reader pass'), did('Update the pattern library')] },
    { id: 'SB-110', col: 'review', title: 'Broken logo on older Safari', labels: ['bug', 'frontend'], assignee: 'PN', due: '2026-09-24', priority: 'high',
      description: 'The SVG logo rendered as a black square on older Safari because of an unsupported mask. The mask is now a clip path.',
      checklist: [did('Reproduce'), did('Replace the mask with a clip path')] },

    { id: 'SB-111', col: 'done', title: 'Brand colour tokens', labels: ['design'], assignee: 'AK', due: '2026-09-16', priority: 'medium',
      description: 'The relaunch palette as design tokens, with a contrast pair checked for every text colour.',
      checklist: [did('Palette'), did('Contrast pairs'), did('Token names'), did('Publish to the library')] },
    { id: 'SB-112', col: 'done', title: 'Staging environment', labels: ['backend'], assignee: 'JW', due: '2026-09-15', priority: 'medium',
      description: 'A staging copy of the new site that deploys on every merge to main.',
      checklist: [did('Provision'), did('Deploy on merge'), did('Password protect')] },
    { id: 'SB-113', col: 'done', title: 'Content inventory', labels: ['design'], assignee: 'LO', due: '2026-09-17', priority: 'low',
      description: 'Every page of the old site, with an owner and a keep, merge or retire decision.',
      checklist: [did('Crawl the old site'), did('Assign owners'), did('Keep, merge or retire'), did('Share with editors'), did('Freeze the list'), did('Archive the spreadsheet')] },
    { id: 'SB-114', col: 'done', title: 'Login form double submit', labels: ['bug', 'backend'], assignee: 'MR', due: '2026-09-18', priority: 'high',
      description: 'Pressing Enter twice created two sessions. The button now disables itself while the request is in flight, and the endpoint is idempotent.',
      checklist: [did('Disable the button in flight'), did('Idempotent endpoint')] }
  ];

  // ------------------------------------------------------------------ calendar (no Date object)

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function ymd(s) { var p = s.split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; }
  // Days since 1970-01-01, proleptic Gregorian: pure arithmetic, no time zone involved.
  function dayNumber(t) {
    var y = t.m <= 2 ? t.y - 1 : t.y;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var mp = (t.m + 9) % 12;
    var doy = Math.floor((153 * mp + 2) / 5) + t.d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  var TODAY_N = dayNumber(ymd(TODAY));
  function weekday(t) { return WEEKDAYS[((dayNumber(t) % 7) + 11) % 7]; }
  function shortDate(t) { return MONTHS[t.m - 1] + ' ' + t.d; }
  function longDate(t) { return weekday(t) + ', ' + MONTHS[t.m - 1] + ' ' + t.d + ', ' + t.y; }

  function dueState(card, colId) {
    if (!card.due) return null;
    var t = ymd(card.due);
    var diff = dayNumber(t) - TODAY_N;
    var kind = 'upcoming';
    if (colId === 'done') kind = 'done';
    else if (diff < 0) kind = 'overdue';
    else if (diff === 0) kind = 'today';
    return { kind: kind, diff: diff, short: shortDate(t), long: longDate(t) };
  }

  // ------------------------------------------------------------------ icons

  var ICON = {
    bars: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect class="bar b1" x="1.5" y="9.5" width="3.2" height="4.5" rx="1"/><rect class="bar b2" x="6.4" y="6" width="3.2" height="8" rx="1"/><rect class="bar b3" x="11.3" y="2.5" width="3.2" height="11.5" rx="1"/></svg>',
    urgent: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor"/><path d="M8 4.6v4.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11.3" r="1.1" fill="#fff"/></svg>',
    check: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2.25" y="2.25" width="11.5" height="11.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.2 8.2l1.9 1.9 3.7-4.1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    calendar: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 6.6h11M5.5 1.8v2.9M10.5 1.8v2.9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.8V8l2.2 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    dots: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="3.5" cy="8" r="1.45"/><circle cx="8" cy="8" r="1.45"/><circle cx="12.5" cy="8" r="1.45"/></svg>',
    warn: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2.3l6.1 10.9H1.9z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.5" r=".9" fill="currentColor"/></svg>'
  };

  // ------------------------------------------------------------------ state and elements

  var cards = {};
  var items = {};
  SEED.forEach(function (c) { cards[c.id] = c; });
  var nextNumber = 115;
  var filter = 'all';
  var query = '';

  var board = document.getElementById('board');
  var colEls = COLUMNS.map(function (c) { return document.getElementById('col-' + c.id); });
  var lists = colEls.map(function (el) { return el.querySelector('[data-list]'); });
  var announcer = document.getElementById('announcer');
  var hint = document.getElementById('kb-hint');
  var hintStatus = document.getElementById('kb-hint-status');
  var hintKeys = document.getElementById('kb-hint-keys');
  var menu = document.getElementById('card-menu');
  var dialog = document.getElementById('card-dialog');
  var search = document.getElementById('search');
  var summary = document.getElementById('filter-summary');
  var clearBtn = document.getElementById('clear-filters');
  var jumpBtns = Array.prototype.slice.call(document.querySelectorAll('[data-jump]'));

  var indicator = document.createElement('div');
  indicator.className = 'drop-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  function colIndexById(id) { for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i].id === id) return i; return -1; }
  function colIndexOf(li) { return lists.indexOf(li.parentElement); }
  function cardItems(list) { return Array.prototype.filter.call(list.children, function (n) { return n.classList.contains('card-item'); }); }
  function visibleItems(list, exclude) { return cardItems(list).filter(function (n) { return !n.hidden && n !== exclude; }); }
  function cardOf(li) { return li.querySelector('.card'); }
  function idOf(li) { return li.getAttribute('data-id'); }
  function quote(t) { return '‘' + t + '’'; }
  function isDone(i) { return i.done; }
  function srOnly(text) { var s = document.createElement('span'); s.className = 'sr-only'; s.textContent = text; return s; }
  function motionOn() {
    if (document.documentElement.classList.contains('no-motion')) return false;
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var flip = false;
  function announce(msg) {
    // A trailing no-break space toggles so a repeated message is still a change.
    flip = !flip;
    announcer.textContent = msg + (flip ? '' : ' ');
  }

  function positionOf(li) {
    var ci = colIndexOf(li);
    var vis = visibleItems(lists[ci]);
    return { ci: ci, col: COLUMNS[ci], pos: vis.indexOf(li) + 1, n: vis.length };
  }
  function whereText(p) { return p.col.title + ', position ' + p.pos + ' of ' + p.n; }
  function overBy(ci) {
    var c = COLUMNS[ci];
    return c.limit ? Math.max(0, cardItems(lists[ci]).length - c.limit) : 0;
  }
  function wipNote(ci) {
    return overBy(ci) ? ' ' + COLUMNS[ci].title + ' is over its limit of ' + COLUMNS[ci].limit + '.' : '';
  }

  // ------------------------------------------------------------------ cards

  function buildItem(card) {
    var li = document.createElement('li');
    li.className = 'card-item';
    li.setAttribute('data-id', card.id);

    var el = document.createElement('div');
    el.className = 'card';
    el.id = 'card-' + card.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('draggable', 'true');
    el.setAttribute('aria-labelledby', 'title-' + card.id);
    el.setAttribute('aria-describedby', 'labels-' + card.id + ' meta-' + card.id + ' dnd-help');

    // Top row: what it is (labels) and who has it (avatar); the ⋯ button sits in the corner beside them.
    var top = document.createElement('div');
    top.className = 'card-top';
    var labels = document.createElement('div');
    labels.className = 'card-labels';
    labels.id = 'labels-' + card.id;
    top.appendChild(labels);
    var title = document.createElement('p');
    title.className = 'card-title';
    title.id = 'title-' + card.id;
    title.textContent = card.title;
    var meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.id = 'meta-' + card.id;
    el.appendChild(top);
    el.appendChild(title);
    el.appendChild(meta);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-menu-btn';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Actions for ' + card.title);
    btn.innerHTML = ICON.dots;

    li.appendChild(el);
    li.appendChild(btn);

    el.addEventListener('click', onCardClick);
    el.addEventListener('keydown', onCardKeydown);
    el.addEventListener('focus', onCardFocus);
    el.addEventListener('blur', onCardBlur);
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    btn.addEventListener('click', onMenuButtonClick);
    btn.addEventListener('keydown', onMenuButtonKeydown);

    items[card.id] = li;
    return li;
  }

  function renderCard(li) {
    var card = cards[idOf(li)];
    var colId = COLUMNS[colIndexOf(li)].id;
    card.col = colId;
    var el = cardOf(li);
    var top = el.querySelector('.card-top');
    var labels = el.querySelector('.card-labels');
    var meta = el.querySelector('.card-meta');

    labels.textContent = '';
    card.labels.forEach(function (key) {
      var s = document.createElement('span');
      s.className = 'label label--' + key;
      s.textContent = LABELS[key];
      labels.appendChild(s);
    });
    var oldAvatar = top.querySelector('.avatar');
    if (oldAvatar) top.removeChild(oldAvatar);
    if (card.assignee) {
      var who = PEOPLE[card.assignee];
      var av = document.createElement('span');
      av.className = 'avatar';
      av.style.setProperty('--av', who.color);
      av.setAttribute('aria-hidden', 'true');
      av.title = who.name;
      av.textContent = card.assignee;
      top.appendChild(av);
    }
    top.hidden = card.labels.length === 0 && !card.assignee;
    el.classList.toggle('card--bare', top.hidden);

    meta.textContent = '';
    var p = document.createElement('span');
    p.className = 'meta prio prio--' + card.priority;
    p.innerHTML = card.priority === 'urgent' ? ICON.urgent : ICON.bars;
    p.appendChild(document.createTextNode(PRIORITY[card.priority]));
    p.appendChild(srOnly(' priority'));
    meta.appendChild(p);

    if (card.checklist.length) {
      var doneN = card.checklist.filter(isDone).length;
      var c = document.createElement('span');
      c.className = 'meta check' + (doneN === card.checklist.length ? ' check--complete' : '');
      c.innerHTML = ICON.check;
      c.appendChild(document.createTextNode(doneN + '/' + card.checklist.length));
      c.appendChild(srOnly(' checklist items done'));
      meta.appendChild(c);
    }

    var due = dueState(card, colId);
    if (due) {
      var d = document.createElement('span');
      d.className = 'meta due due--' + due.kind;
      if (due.kind === 'overdue') {
        d.innerHTML = ICON.clock;
        d.appendChild(document.createTextNode('Overdue'));
        d.appendChild(srOnly(', was due ' + due.long));
      } else if (due.kind === 'today') {
        d.innerHTML = ICON.clock;
        d.appendChild(document.createTextNode('Due today'));
      } else {
        d.innerHTML = ICON.calendar;
        d.appendChild(srOnly('Due '));
        d.appendChild(document.createTextNode(due.short));
      }
      meta.appendChild(d);
    }

    // The avatar is drawn in the top row; the name stays in the described meta for screen readers.
    if (card.assignee) meta.appendChild(srOnly('Assigned to ' + PEOPLE[card.assignee].name));
  }

  // ------------------------------------------------------------------ columns, counts, filters

  function updateColumns() {
    var total = 0;
    // Name what actually hides cards, so the note points at the control the reader used.
    var cause = filter !== 'all' && query ? 'the filter and search' : (query ? 'the search' : 'the filter');
    COLUMNS.forEach(function (col, ci) {
      var el = colEls[ci];
      var all = cardItems(lists[ci]);
      var n = all.length;
      var vis = all.filter(function (li) { return !li.hidden; }).length;
      total += n;

      var count = el.querySelector('[data-count]');
      count.textContent = '';
      if (col.limit) {
        var tag = document.createElement('span');
        tag.className = 'count-tag';
        tag.textContent = 'WIP';
        count.appendChild(tag);
        count.appendChild(document.createTextNode(n + ' / ' + col.limit));
        count.appendChild(srOnly(' cards, limit ' + col.limit));
      } else {
        count.appendChild(document.createTextNode(String(n)));
        count.appendChild(srOnly(n === 1 ? ' card' : ' cards'));
      }

      var over = overBy(ci);
      el.classList.toggle('is-over', over > 0);
      var alertEl = el.querySelector('[data-wip-alert]');
      if (over > 0) {
        alertEl.innerHTML = ICON.warn;
        var body = document.createElement('span');
        var fact = document.createElement('strong');
        fact.textContent = 'Over the WIP limit by ' + over + (over === 1 ? ' card' : ' cards');
        var advice = document.createElement('span');
        advice.className = 'wip-advice';
        advice.textContent = 'Finish something before starting more.';
        body.appendChild(fact);
        body.appendChild(advice);
        alertEl.appendChild(body);
        alertEl.hidden = false;
      } else {
        alertEl.hidden = true;
        alertEl.textContent = '';
      }

      var note = el.querySelector('[data-note]');
      note.classList.remove('is-empty');
      if (n === 0) {
        note.textContent = 'No cards here yet';
        note.classList.add('is-empty');
        note.hidden = false;
      } else if (vis === 0) {
        note.textContent = 'No cards match ' + cause;
        note.classList.add('is-empty');
        note.hidden = false;
      } else if (vis < n) {
        note.textContent = (n - vis) + (n - vis === 1 ? ' card' : ' cards') + ' hidden by ' + cause;
        note.hidden = false;
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    });
    document.getElementById('card-total').textContent = total + (total === 1 ? ' card' : ' cards');
  }

  function matches(card) {
    return (filter === 'all' || card.labels.indexOf(filter) !== -1) &&
      (!query || card.title.toLowerCase().indexOf(query) !== -1);
  }

  function applyFilters() {
    var shown = 0, total = 0;
    Object.keys(items).forEach(function (id) {
      var ok = matches(cards[id]);
      items[id].hidden = !ok;
      total++;
      if (ok) shown++;
    });
    updateColumns();
    var active = filter !== 'all' || query !== '';
    summary.textContent = active ? 'Showing ' + shown + ' of ' + total + ' cards' : 'Showing all ' + total + ' cards';
    summary.parentElement.classList.toggle('is-idle', !active);
    clearBtn.hidden = !active;
  }

  // ------------------------------------------------------------------ moving cards (shared by every path)

  var movingDom = false;

  function place(list, li, ref) {
    if (ref === li) return;
    var active = document.activeElement;
    var keep = active && li.contains(active) ? active : null;
    movingDom = true;
    try {
      if (typeof list.moveBefore === 'function' && li.isConnected) list.moveBefore(li, ref || null);
      else list.insertBefore(li, ref || null);
    } catch (err) {
      list.insertBefore(li, ref || null);
    }
    if (keep && document.activeElement !== keep) keep.focus({ preventScroll: true });
    movingDom = false;
  }

  function afterMove(li) {
    renderCard(li);
    updateColumns();
  }

  // The drop settle: a 180ms keyframe animation from a lifted pose to rest (styles.css sb-settle).
  // Restarted on every drop; reduced motion and ?animate=0 skip it entirely.
  function settle(li) {
    if (!motionOn()) return;
    var el = cardOf(li);
    el.classList.remove('is-settling');
    void el.offsetWidth;
    el.classList.add('is-settling');
  }

  function reveal(node) {
    try { node.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { node.scrollIntoView(false); }
  }

  function markTarget(ci) {
    colEls.forEach(function (el, i) { el.classList.toggle('is-target', i === ci); });
  }

  function movedMessage(li) {
    var p = positionOf(li);
    return 'Moved ' + quote(cards[idOf(li)].title) + ' to ' + p.col.title + ', position ' + p.pos + ' of ' + p.n + '.' + wipNote(p.ci);
  }

  // ------------------------------------------------------------------ keyboard: Space lifts, arrows move, Space drops, Escape cancels

  var lifted = null;

  function lift(li) {
    closeMenu(false);
    lifted = { li: li, originList: li.parentElement, originNext: li.nextElementSibling };
    li.classList.add('is-lifted');
    cardOf(li).classList.add('is-lifted');
    markTarget(colIndexOf(li));
    showHint('moving', li);
    announce('Picked up ' + quote(cards[idOf(li)].title) + '. ' + whereText(positionOf(li)) + '. Use the arrow keys to move it, Space to drop it, Escape to cancel.');
  }

  function endLift() {
    var li = lifted.li;
    lifted = null;
    li.classList.remove('is-lifted');
    cardOf(li).classList.remove('is-lifted');
    markTarget(-1);
    return li;
  }

  function moveLifted(key) {
    var li = lifted.li;
    var ci = colIndexOf(li);
    var list = lists[ci];
    var vis = visibleItems(list);
    var pos = vis.indexOf(li);
    var title = cards[idOf(li)].title;

    if (key === 'ArrowUp' || key === 'Home') {
      if (pos <= 0) { announce(quote(title) + ' is already at the top of ' + COLUMNS[ci].title + '.'); return; }
      place(list, li, key === 'Home' ? vis[0] : vis[pos - 1]);
    } else if (key === 'ArrowDown' || key === 'End') {
      if (pos >= vis.length - 1) { announce(quote(title) + ' is already at the bottom of ' + COLUMNS[ci].title + '.'); return; }
      var after = key === 'End' ? vis[vis.length - 1] : vis[pos + 1];
      place(list, li, after.nextElementSibling);
    } else {
      var t = ci + (key === 'ArrowLeft' ? -1 : 1);
      if (t < 0 || t >= COLUMNS.length) {
        announce(quote(title) + ' is already in the ' + (t < 0 ? 'first' : 'last') + ' column.');
        return;
      }
      var target = visibleItems(lists[t]);
      place(lists[t], li, pos < target.length ? target[pos] : null);
      markTarget(t);
    }
    afterMove(li);
    reveal(li);
    showHint('moving', li);
    announce(quote(title) + ': ' + whereText(positionOf(li)) + '.' + wipNote(colIndexOf(li)));
  }

  function dropLifted() {
    var origin = lifted;
    var li = endLift();
    var moved = li.parentElement !== origin.originList || li.nextElementSibling !== origin.originNext;
    afterMove(li);
    showHint('idle', li);
    if (moved) announce(movedMessage(li));
    else announce(quote(cards[idOf(li)].title) + ' dropped where it started: ' + whereText(positionOf(li)) + '.');
  }

  function cancelLifted() {
    var origin = lifted;
    var li = endLift();
    place(origin.originList, li, origin.originNext);
    afterMove(li);
    reveal(li);
    if (document.activeElement === cardOf(li)) showHint('idle', li); else hideHint();
    announce('Move cancelled. ' + quote(cards[idOf(li)].title) + ' is back in ' + whereText(positionOf(li)) + '.');
  }

  function onCardKeydown(e) {
    var li = e.currentTarget.parentElement;
    var k = e.key;
    if (lifted && lifted.li === li) {
      if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') {
        e.preventDefault();
        moveLifted(k);
      } else if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
        e.preventDefault();
        dropLifted();
      } else if (k === 'Escape') {
        e.preventDefault();
        cancelLifted();
      } else if (k === 'Tab') {
        cancelLifted();
      }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      lift(li);
    } else if (k === 'Enter') {
      e.preventDefault();
      openDialog(idOf(li), e.currentTarget);
    } else if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
      e.preventDefault();
      openMenu(li.querySelector('.card-menu-btn'), 'first');
    }
  }

  function onCardClick(e) {
    var li = e.currentTarget.parentElement;
    if (lifted) {
      if (lifted.li === li) dropLifted();
      return;
    }
    openDialog(idOf(li), e.currentTarget);
  }

  function onCardFocus(e) {
    var el = e.currentTarget;
    var visible = false;
    try { visible = el.matches(':focus-visible'); } catch (err) { visible = false; }
    if (!lifted && visible) showHint('idle', el.parentElement);
  }

  function onCardBlur(e) {
    if (movingDom) return;
    if (lifted && cardOf(lifted.li) === e.currentTarget) cancelLifted();
    hideHint();
  }

  function keyGroup(keys, label) {
    return '<span>' + keys.map(function (k) { return '<kbd>' + k + '</kbd>'; }).join('') + '&nbsp;' + label + '</span>';
  }

  function showHint(mode, li) {
    hint.classList.toggle('is-moving', mode === 'moving');
    if (mode === 'moving') {
      // "position 2 of 3" never breaks across lines: it is the part of the hint the eye looks for.
      var p = positionOf(li);
      hintStatus.textContent = 'Moving ' + quote(cards[idOf(li)].title) + ' · ' + p.col.title + ', ' +
        ['position', p.pos, 'of', p.n].join(' ');
      hintKeys.innerHTML = keyGroup(['←', '→'], 'column') + keyGroup(['↑', '↓'], 'position') +
        keyGroup(['Space'], 'drop') + keyGroup(['Esc'], 'cancel');
    } else {
      hintStatus.textContent = 'Keyboard';
      hintKeys.innerHTML = keyGroup(['Space'], 'pick up') + keyGroup(['Enter'], 'open') + keyGroup(['Shift', 'F10'], 'menu');
    }
    hint.hidden = false;
  }

  function hideHint() { hint.hidden = true; }

  // ------------------------------------------------------------------ pointer: HTML5 drag and drop

  var drag = null;

  function onDragStart(e) {
    var li = e.currentTarget.parentElement;
    if (lifted) cancelLifted();
    closeMenu(false);
    hideHint();
    drag = { li: li, id: idOf(li) };
    var dt = e.dataTransfer;
    if (dt) {
      dt.effectAllowed = 'move';
      dt.setData('text/plain', cards[drag.id].title);
      try { dt.setData('application/x-sprintboard-card', drag.id); } catch (err) { /* text/plain still carries it */ }
    }
    // Fade the source only after the browser has taken its drag image.
    window.requestAnimationFrame(function () { if (drag && drag.li === li) li.classList.add('is-dragging'); });
  }

  function dropSpot(ci, clientY, exclude) {
    var vis = visibleItems(lists[ci], exclude);
    var before = null;
    for (var i = 0; i < vis.length; i++) {
      var r = vis[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) { before = vis[i]; break; }
    }
    return { ci: ci, vis: vis, before: before };
  }

  function showIndicator(spot) {
    var col = colEls[spot.ci];
    var cr = col.getBoundingClientRect();
    var vis = spot.vis;
    var idx = spot.before ? vis.indexOf(spot.before) : vis.length;
    var y;
    if (!vis.length) y = lists[spot.ci].getBoundingClientRect().top + 2;
    else if (idx === 0) y = vis[0].getBoundingClientRect().top - 4;
    else if (idx === vis.length) y = vis[vis.length - 1].getBoundingClientRect().bottom + 4;
    else y = (vis[idx - 1].getBoundingClientRect().bottom + vis[idx].getBoundingClientRect().top) / 2;
    indicator.style.top = (y - cr.top - col.clientTop) + 'px';
    if (indicator.parentElement !== col) col.appendChild(indicator);
  }

  function clearDragUi() {
    markTarget(-1);
    if (indicator.parentElement) indicator.parentElement.removeChild(indicator);
  }

  function onDragEnter(e) {
    e.preventDefault();
  }

  function onDragOver(e) {
    // Always accept: a stray file dropped on the board must not navigate the page away.
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (!drag) return;
    var ci = colEls.indexOf(e.currentTarget);
    markTarget(ci);
    showIndicator(dropSpot(ci, e.clientY, drag.li));
  }

  function onDragLeave(e) {
    var col = e.currentTarget;
    if (e.relatedTarget && col.contains(e.relatedTarget)) return;
    col.classList.remove('is-target');
    if (indicator.parentElement === col) col.removeChild(indicator);
  }

  function onDrop(e) {
    e.preventDefault();
    var ci = colEls.indexOf(e.currentTarget);
    var id = '';
    if (e.dataTransfer) {
      try { id = e.dataTransfer.getData('application/x-sprintboard-card'); } catch (err) { id = ''; }
    }
    if (!id && drag) id = drag.id;
    var li = id ? items[id] : null;
    clearDragUi();
    if (!li) return;
    var fromList = li.parentElement;
    var fromNext = li.nextElementSibling;
    var spot = dropSpot(ci, e.clientY, li);
    place(lists[ci], li, spot.before);
    li.classList.remove('is-dragging');
    afterMove(li);
    settle(li);
    if (li.parentElement !== fromList || li.nextElementSibling !== fromNext) announce(movedMessage(li));
  }

  function onDragEnd(e) {
    var li = e.currentTarget.parentElement;
    li.classList.remove('is-dragging');
    clearDragUi();
    drag = null;
  }

  // ------------------------------------------------------------------ card menu (⋯)

  var menuFor = null;

  function menuItems() { return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]')); }

  function menuItem(text, opts) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-item';
    b.setAttribute('role', 'menuitem');
    b.tabIndex = -1;
    b.setAttribute('data-action', opts.action);
    if (opts.to) {
      b.setAttribute('data-to', opts.to);
      var dot = document.createElement('span');
      dot.className = 'status-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.setProperty('--st', 'var(--st-' + opts.to + ')');
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(text));
    if (opts.current) {
      b.setAttribute('aria-disabled', 'true');
      var cur = document.createElement('span');
      cur.className = 'menu-current';
      cur.textContent = 'Current';
      b.appendChild(cur);
    }
    return b;
  }

  function openMenu(btn, focusWhich) {
    if (lifted) cancelLifted();
    closeMenu(false);
    var li = btn.parentElement;
    var id = idOf(li);
    var here = colIndexOf(li);

    menu.textContent = '';
    menu.setAttribute('aria-label', 'Actions for ' + cards[id].title);
    menu.appendChild(menuItem('Open card', { action: 'open' }));
    var sep = document.createElement('div');
    sep.className = 'menu-sep';
    sep.setAttribute('role', 'separator');
    menu.appendChild(sep);
    var group = document.createElement('div');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Move to…');
    var lab = document.createElement('p');
    lab.className = 'menu-label';
    lab.setAttribute('aria-hidden', 'true');
    lab.textContent = 'Move to…';
    group.appendChild(lab);
    COLUMNS.forEach(function (col, ci) {
      group.appendChild(menuItem(col.title, { action: 'move', to: col.id, current: ci === here }));
    });
    menu.appendChild(group);

    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    menuFor = { li: li, btn: btn };
    positionMenu();
    var its = menuItems();
    (focusWhich === 'last' ? its[its.length - 1] : its[0]).focus();
  }

  // Anchored under its ⋯ button (flipped above it near the bottom of the screen), in page coordinates.
  function positionMenu() {
    var r = menuFor.btn.getBoundingClientRect();
    var mw = menu.offsetWidth;
    var mh = menu.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    var left = Math.min(Math.max(8, r.right - mw), vw - mw - 8);
    var top = r.bottom + 6;
    if (top + mh > vh - 8 && r.top - mh - 6 >= 8) top = r.top - mh - 6;
    menu.style.left = Math.round(left + window.scrollX) + 'px';
    menu.style.top = Math.round(top + window.scrollY) + 'px';
  }

  function triggerInBoard(btn) {
    var r = btn.getBoundingClientRect();
    var b = board.getBoundingClientRect();
    return r.right > b.left + 4 && r.left < b.right - 4;
  }

  function closeMenu(returnFocus) {
    if (!menuFor) return;
    var btn = menuFor.btn;
    menuFor = null;
    menu.hidden = true;
    menu.textContent = '';
    btn.setAttribute('aria-expanded', 'false');
    if (returnFocus) btn.focus();
  }

  function onMenuButtonClick(e) {
    var btn = e.currentTarget;
    if (menuFor && menuFor.btn === btn) { closeMenu(true); return; }
    openMenu(btn, 'first');
  }

  function onMenuButtonKeydown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.currentTarget, e.key === 'ArrowUp' ? 'last' : 'first');
    }
  }

  function activateItem(it) {
    if (!menuFor || it.getAttribute('aria-disabled') === 'true') return;
    var li = menuFor.li;
    var btn = menuFor.btn;
    var id = idOf(li);
    var action = it.getAttribute('data-action');
    if (action === 'open') {
      closeMenu(false);
      openDialog(id, btn);
      return;
    }
    if (action === 'move') {
      var ci = colIndexById(it.getAttribute('data-to'));
      closeMenu(false);
      place(lists[ci], li, null);
      afterMove(li);
      settle(li);
      btn.focus({ preventScroll: true });
      reveal(li);
      announce(movedMessage(li));
    }
  }

  menu.addEventListener('keydown', function (e) {
    var its = menuItems();
    var i = its.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); its[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); its[its.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'Tab') { closeMenu(true); }
  });
  menu.addEventListener('click', function (e) {
    var it = e.target.closest ? e.target.closest('.menu-item') : null;
    if (it) activateItem(it);
  });
  menu.addEventListener('focusout', function (e) {
    if (menuFor && e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== menuFor.btn) closeMenu(false);
  });
  document.addEventListener('pointerdown', function (e) {
    if (menuFor && !menu.contains(e.target) && !menuFor.btn.contains(e.target)) closeMenu(false);
  });
  window.addEventListener('resize', function () { closeMenu(false); });

  // ------------------------------------------------------------------ card detail dialog

  var dlgFor = null;
  var dlgReturn = null;
  var dlg = {
    dot: document.getElementById('dlg-dot'),
    col: document.getElementById('dlg-col'),
    id: document.getElementById('dlg-id'),
    title: document.getElementById('dlg-title'),
    close: document.getElementById('dlg-close'),
    labels: document.getElementById('dlg-labels'),
    assignee: document.getElementById('dlg-assignee'),
    due: document.getElementById('dlg-due'),
    priority: document.getElementById('dlg-priority'),
    desc: document.getElementById('dlg-desc'),
    progressText: document.getElementById('dlg-progress-text'),
    bar: document.getElementById('dlg-progress-bar'),
    checklist: document.getElementById('dlg-checklist'),
    empty: document.getElementById('dlg-check-empty')
  };

  function chip(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function fillDialog() {
    var card = cards[dlgFor];
    var col = COLUMNS[colIndexOf(items[dlgFor])];
    dlg.dot.style.setProperty('--st', 'var(--st-' + col.id + ')');
    dlg.col.textContent = col.title;
    dlg.id.textContent = card.id;
    dlg.title.textContent = card.title;

    dlg.labels.textContent = '';
    card.labels.forEach(function (key) { dlg.labels.appendChild(chip('label label--' + key, LABELS[key])); });

    dlg.assignee.textContent = '';
    if (card.assignee) {
      var person = PEOPLE[card.assignee];
      var a = chip('avatar', card.assignee);
      a.style.setProperty('--av', person.color);
      a.setAttribute('aria-hidden', 'true');
      dlg.assignee.appendChild(a);
      dlg.assignee.appendChild(document.createTextNode(person.name));
    } else {
      dlg.assignee.textContent = 'Unassigned';
    }

    dlg.due.textContent = '';
    var due = dueState(card, col.id);
    if (due) {
      dlg.due.appendChild(document.createTextNode(due.long));
      if (due.kind === 'overdue') dlg.due.appendChild(chip('meta due due--overdue', 'Overdue by ' + (-due.diff) + (due.diff === -1 ? ' day' : ' days')));
      if (due.kind === 'today') dlg.due.appendChild(chip('meta due due--today', 'Due today'));
    } else {
      dlg.due.textContent = 'No due date';
    }

    dlg.priority.textContent = '';
    var p = document.createElement('span');
    p.className = 'meta prio prio--' + card.priority;
    p.innerHTML = card.priority === 'urgent' ? ICON.urgent : ICON.bars;
    p.appendChild(document.createTextNode(PRIORITY[card.priority]));
    dlg.priority.appendChild(p);

    dlg.desc.textContent = card.description || 'No description yet.';

    dlg.checklist.textContent = '';
    card.checklist.forEach(function (it, i) {
      var row = document.createElement('li');
      var label = document.createElement('label');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = it.done;
      box.setAttribute('data-index', String(i));
      var text = document.createElement('span');
      text.textContent = it.text;
      label.appendChild(box);
      label.appendChild(text);
      row.appendChild(label);
      dlg.checklist.appendChild(row);
    });
    var has = card.checklist.length > 0;
    dlg.checklist.hidden = !has;
    dlg.bar.parentElement.hidden = !has;
    dlg.progressText.hidden = !has;
    dlg.empty.hidden = has;
    updateProgress();
  }

  function updateProgress() {
    var list = cards[dlgFor].checklist;
    var n = list.length;
    var d = list.filter(isDone).length;
    dlg.progressText.textContent = n ? d + ' of ' + n + ' done' : '';
    dlg.bar.style.setProperty('--p', n ? Math.round((d / n) * 100) + '%' : '0%');
    dlg.bar.parentElement.classList.toggle('is-complete', n > 0 && d === n);
  }

  function openDialog(id, returnTo) {
    closeMenu(false);
    hideHint();
    dlgFor = id;
    dlgReturn = returnTo || document.activeElement;
    fillDialog();
    dialog.showModal();
    dlg.close.focus();
  }

  dialog.addEventListener('close', function () {
    var r = dlgReturn;
    dlgFor = null;
    dlgReturn = null;
    if (r && r.isConnected) r.focus();
  });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dlg.close.addEventListener('click', function () { dialog.close(); });
  dlg.checklist.addEventListener('change', function (e) {
    var box = e.target;
    if (!dlgFor || !box.matches('input[type="checkbox"]')) return;
    cards[dlgFor].checklist[+box.getAttribute('data-index')].done = box.checked;
    updateProgress();
    renderCard(items[dlgFor]);
  });

  // ------------------------------------------------------------------ add a card (inline form at the foot of each column)

  var openFormCi = -1;

  function formParts(ci) {
    var el = colEls[ci];
    var form = el.querySelector('[data-form]');
    return {
      form: form,
      input: form.querySelector('textarea'),
      error: form.querySelector('[data-error]'),
      button: el.querySelector('.add-card-btn')
    };
  }

  function openForm(ci) {
    if (openFormCi !== -1 && openFormCi !== ci) closeForm(openFormCi, false);
    var f = formParts(ci);
    f.button.hidden = true;
    f.form.hidden = false;
    openFormCi = ci;
    f.input.focus({ preventScroll: true });
    reveal(f.form);
  }

  function closeForm(ci, returnFocus) {
    var f = formParts(ci);
    f.form.hidden = true;
    f.button.hidden = false;
    f.input.value = '';
    f.error.hidden = true;
    f.input.removeAttribute('aria-invalid');
    if (openFormCi === ci) openFormCi = -1;
    if (returnFocus) f.button.focus();
  }

  function submitForm(ci) {
    var f = formParts(ci);
    var title = f.input.value.replace(/\s+/g, ' ').trim();
    if (!title) {
      f.error.hidden = false;
      f.input.setAttribute('aria-invalid', 'true');
      f.input.focus();
      return;
    }
    var id = 'SB-' + nextNumber++;
    var card = { id: id, title: title, labels: filter !== 'all' ? [filter] : [], assignee: null, due: null, priority: 'medium', description: '', checklist: [] };
    cards[id] = card;
    var li = buildItem(card);
    lists[ci].appendChild(li);
    renderCard(li);
    applyFilters();
    settle(li);
    f.input.value = '';
    f.input.focus({ preventScroll: true });
    reveal(f.form);
    if (li.hidden) {
      announce('Added ' + quote(title) + ' to ' + COLUMNS[ci].title + '. The current search hides it.' + wipNote(ci));
    } else {
      var p = positionOf(li);
      announce('Added ' + quote(title) + ' to ' + whereText(p) + '.' + wipNote(ci));
    }
  }

  COLUMNS.forEach(function (col, ci) {
    var el = colEls[ci];
    var f = formParts(ci);
    f.error.id = 'add-error-' + col.id;
    f.input.setAttribute('aria-describedby', f.error.id);
    Array.prototype.forEach.call(el.querySelectorAll('[data-add]'), function (b) {
      b.addEventListener('click', function () { openForm(ci); });
    });
    f.form.addEventListener('submit', function (e) { e.preventDefault(); submitForm(ci); });
    f.form.querySelector('[data-cancel]').addEventListener('click', function () { closeForm(ci, true); });
    f.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitForm(ci); }
      else if (e.key === 'Escape') { e.preventDefault(); closeForm(ci, true); }
    });
    f.input.addEventListener('input', function () {
      if (!f.error.hidden && f.input.value.trim()) {
        f.error.hidden = true;
        f.input.removeAttribute('aria-invalid');
      }
    });

    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
  });

  document.getElementById('new-task').addEventListener('click', function () { openForm(0); });

  // ------------------------------------------------------------------ filters and search

  Array.prototype.forEach.call(document.querySelectorAll('input[name="label-filter"]'), function (r) {
    r.addEventListener('change', function () {
      if (!r.checked) return;
      filter = r.value;
      applyFilters();
    });
  });
  function onSearch() {
    query = search.value.trim().toLowerCase();
    applyFilters();
  }
  search.addEventListener('input', onSearch);
  search.addEventListener('search', onSearch);
  clearBtn.addEventListener('click', function () {
    var all = document.querySelector('input[name="label-filter"][value="all"]');
    filter = 'all';
    query = '';
    search.value = '';
    all.checked = true;
    applyFilters();
    all.focus();
  });

  // ------------------------------------------------------------------ phones: which column is on screen

  function scrollPad() { return parseFloat(window.getComputedStyle(board).scrollPaddingLeft) || 0; }

  function setCurrent(ci) {
    jumpBtns.forEach(function (b, i) { b.setAttribute('aria-current', i === ci ? 'true' : 'false'); });
  }

  var syncQueued = false;
  function syncSwitch() {
    syncQueued = false;
    var x = board.scrollLeft + scrollPad();
    var best = 0, bestD = Infinity;
    colEls.forEach(function (c, i) {
      var d = Math.abs(c.offsetLeft - x);
      if (d < bestD) { bestD = d; best = i; }
    });
    // The last column cannot reach the snap edge; at the far end it is the one on screen.
    if (board.scrollWidth > board.clientWidth + 2 && board.scrollLeft + board.clientWidth >= board.scrollWidth - 2) best = colEls.length - 1;
    setCurrent(best);
  }

  board.addEventListener('scroll', function () {
    // A tap on ⋯ can itself scroll the board (the button is brought into view, a snap settles):
    // the menu follows its button, and only closes once the button has left the board.
    if (menuFor) {
      if (triggerInBoard(menuFor.btn)) positionMenu();
      else closeMenu(false);
    }
    if (!syncQueued) { syncQueued = true; window.requestAnimationFrame(syncSwitch); }
  }, { passive: true });

  jumpBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var ci = +b.getAttribute('data-jump');
      board.scrollTo({ left: colEls[ci].offsetLeft - scrollPad(), behavior: motionOn() ? 'smooth' : 'auto' });
      setCurrent(ci);
    });
  });

  // ------------------------------------------------------------------ first paint

  SEED.forEach(function (card) { lists[colIndexById(card.col)].appendChild(buildItem(card)); });
  Object.keys(items).forEach(function (id) { renderCard(items[id]); });
  applyFilters();

  // ?replay=drop drops 'Hero copy' into Review, position 2, as the page opens — through the same
  // place → afterMove → settle path a pointer drop takes — so the settle can be frame-sampled
  // (`vlmkit check animation "index.html?replay=drop"`). Without the parameter nothing moves on load.
  if (/(?:^|[?&])replay=drop(?:&|$)/.test(window.location.search.slice(1))) {
    var hero = items['SB-106'];
    var review = lists[colIndexById('review')];
    var seat = visibleItems(review, hero)[1] || null;
    place(review, hero, seat);
    afterMove(hero);
    settle(hero);
    announce(movedMessage(hero));
  }
})();
