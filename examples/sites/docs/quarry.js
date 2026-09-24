/* Quarry docs — one classic script for every page, loaded in <head> so the
   theme is set before the first paint. Everything else waits for the DOM. */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'quarry-theme';

  // ------------------------------------------------------------ theme
  // Order of precedence: ?theme=light|dark (for gates and screenshots), then the
  // choice saved by the toggle, then the operating system (plain CSS).
  function valid(v) { return v === 'light' || v === 'dark' ? v : null; }

  function forcedTheme() {
    try { return valid(new URLSearchParams(window.location.search).get('theme')); } catch (e) { return null; }
  }

  function storedTheme() {
    try { return valid(window.localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  var initialTheme = forcedTheme() || storedTheme();
  if (initialTheme) root.setAttribute('data-theme', initialTheme);

  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    var set = valid(root.getAttribute('data-theme'));
    if (set) return set;
    return darkQuery && darkQuery.matches ? 'dark' : 'light';
  }

  function initThemeToggle() {
    var buttons = [].slice.call(document.querySelectorAll('[data-theme-toggle]'));
    function sync() {
      var dark = effectiveTheme() === 'dark';
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', dark ? 'true' : 'false'); });
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { window.localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* private mode: still switches */ }
        sync();
      });
    });
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', sync);
    sync();
  }

  // ------------------------------------------------------------ live region
  function announce(message) {
    var region = document.getElementById('announcer');
    if (!region) return;
    // A trailing no-break space makes a repeated message count as a change.
    region.textContent = region.textContent === message ? message + ' ' : message;
  }

  // ------------------------------------------------------------ drawer (below 768px)
  var drawerApi = { isOpen: function () { return false; }, open: function () {} };

  function initDrawer() {
    var button = document.querySelector('[data-drawer-open]');
    var drawer = document.getElementById('sidebar');
    if (!button || !drawer) return;
    var closeButton = drawer.querySelector('[data-drawer-close]');
    var scrim = document.querySelector('.scrim');
    var narrow = window.matchMedia('(max-width: 767.98px)');
    var outside = ['.site-header', '.content', '.site-footer', '.toc']
      .map(function (s) { return document.querySelector(s); })
      .filter(Boolean);
    var open = false;

    function focusables() {
      return [].slice.call(drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'))
        .filter(function (el) { return el.getClientRects().length > 0; });
    }

    function setOpen(next, returnFocus) {
      if (next === open) return;
      open = next;
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      drawer.classList.toggle('is-open', open);
      root.classList.toggle('drawer-open', open);
      if (scrim) scrim.hidden = !open;
      if (open) {
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-modal', 'true');
        drawer.setAttribute('aria-label', 'Menu');
      } else {
        drawer.removeAttribute('role');
        drawer.removeAttribute('aria-modal');
        drawer.removeAttribute('aria-label');
      }
      outside.forEach(function (el) { el.inert = open; });
      if (open) {
        (closeButton || drawer).focus();
      } else if (returnFocus) {
        button.focus();
      }
    }

    button.addEventListener('click', function () { setOpen(!open, true); });
    if (closeButton) closeButton.addEventListener('click', function () { setOpen(false, true); });

    // Tab and Shift+Tab stay inside the open drawer.
    drawer.addEventListener('keydown', function (e) {
      if (!open || e.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    document.addEventListener('keydown', function (e) {
      if (open && e.key === 'Escape') { e.preventDefault(); setOpen(false, true); }
    });

    // A click on the scrim (anything outside the drawer) closes it; following a
    // link inside the drawer closes it without pulling focus back to the button.
    document.addEventListener('click', function (e) {
      if (!open || button.contains(e.target)) return;
      if (!drawer.contains(e.target)) { setOpen(false, true); return; }
      if (e.target.closest && e.target.closest('a[href]')) setOpen(false, false);
    });

    narrow.addEventListener('change', function () { if (!narrow.matches) setOpen(false, false); });

    drawerApi = {
      isOpen: function () { return open; },
      open: function () { setOpen(true, false); },
    };
  }

  // ------------------------------------------------------------ sidebar filter
  function initFilter() {
    var nav = document.getElementById('sidebar-nav');
    var inputs = [].slice.call(document.querySelectorAll('[data-nav-filter]'));
    if (!nav || !inputs.length) return;
    var links = [].slice.call(nav.querySelectorAll('a'));
    links.forEach(function (a) { a.setAttribute('data-label', a.textContent); });
    var empty = nav.querySelector('.nav-empty');
    var emptyTerm = nav.querySelector('.nav-empty-term');
    var announceTimer = null;

    function paint(a, q) {
      var label = a.getAttribute('data-label');
      var at = q ? label.toLowerCase().indexOf(q) : -1;
      if (at < 0) { a.textContent = label; return; }
      a.textContent = '';
      a.appendChild(document.createTextNode(label.slice(0, at)));
      var mark = document.createElement('mark');
      mark.textContent = label.slice(at, at + q.length);
      a.appendChild(mark);
      a.appendChild(document.createTextNode(label.slice(at + q.length)));
    }

    function matches(a, q) { return a.getAttribute('data-label').toLowerCase().indexOf(q) >= 0; }

    function apply(raw) {
      var q = raw.trim().toLowerCase();
      var found = 0;
      [].forEach.call(nav.querySelectorAll('.nav-group'), function (group) {
        var pagesShown = 0;
        [].forEach.call(group.querySelectorAll('.nav-page'), function (page) {
          var pageLink = page.querySelector('.nav-page-link');
          var pageHit = !q || matches(pageLink, q);
          var sectionsShown = 0;
          [].forEach.call(page.querySelectorAll('.nav-sections li'), function (li) {
            var a = li.querySelector('a');
            var hit = !q || matches(a, q);
            li.hidden = !hit;
            paint(a, q);
            if (hit) sectionsShown += 1;
          });
          paint(pageLink, q);
          var list = page.querySelector('.nav-sections');
          if (list) list.hidden = sectionsShown === 0;
          page.hidden = !(pageHit || sectionsShown > 0);
          if (!page.hidden) pagesShown += 1;
          if (q) found += (pageHit ? 1 : 0) + sectionsShown;
        });
        group.hidden = pagesShown === 0;
      });
      nav.classList.toggle('is-filtered', !!q);
      if (empty) empty.hidden = !(q && found === 0);
      if (emptyTerm) emptyTerm.textContent = raw.trim();
      clearTimeout(announceTimer);
      if (q) {
        announceTimer = setTimeout(function () {
          announce(found === 0 ? 'No matches' : found === 1 ? '1 match' : found + ' matches');
        }, 400);
      }
    }

    function firstVisibleLink() {
      return links.filter(function (a) { return a.getClientRects().length > 0; })
        .filter(function (a) { return a.querySelector('mark'); })[0] || null;
    }

    inputs.forEach(function (input) {
      input.addEventListener('input', function () {
        inputs.forEach(function (other) { if (other !== input) other.value = input.value; });
        apply(input.value);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) {
          e.preventDefault();
          e.stopPropagation();
          inputs.forEach(function (i) { i.value = ''; });
          apply('');
        } else if (e.key === 'Enter') {
          var target = firstVisibleLink();
          if (target) { e.preventDefault(); target.click(); }
        }
      });
    });

    // "/" jumps to the filter from anywhere that is not already a text field.
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var visible = inputs.filter(function (i) { return i.getClientRects().length > 0; })[0];
      if (!visible && document.querySelector('[data-drawer-open]')) {
        drawerApi.open();
        visible = document.getElementById('search-drawer');
      }
      if (visible) { e.preventDefault(); visible.focus(); }
    });

    inputs.forEach(function (i) { if (i.value) apply(i.value); });
  }

  // ------------------------------------------------------------ copy buttons
  function codeText(code) {
    var clone = code.cloneNode(true);
    [].forEach.call(clone.querySelectorAll('.tok-prompt'), function (n) { n.parentNode.removeChild(n); });
    return clone.textContent.replace(/\n+$/, '');
  }

  // Fallback for when the Clipboard API is refused (file://, older browsers):
  // answer the copy event ourselves, so no temporary field ever takes focus.
  function copyWithEvent(text) {
    var written = false;
    function onCopy(e) {
      if (!e.clipboardData) return;
      e.clipboardData.setData('text/plain', text);
      e.preventDefault();
      written = true;
    }
    document.addEventListener('copy', onCopy);
    try { document.execCommand('copy'); } catch (e) { written = false; }
    document.removeEventListener('copy', onCopy);
    return written;
  }

  function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return copyWithEvent(text); }
      );
    }
    return Promise.resolve(copyWithEvent(text));
  }

  function initCopy() {
    [].forEach.call(document.querySelectorAll('[data-copy]'), function (button) {
      var label = button.querySelector('.copy-label');
      var timer = null;
      button.addEventListener('click', function () {
        var block = button.closest('.code-block');
        var code = block && block.querySelector('pre code');
        if (!code) return;
        writeClipboard(codeText(code)).then(function (ok) {
          clearTimeout(timer);
          if (ok) {
            button.setAttribute('data-copied', '');
            label.textContent = 'Copied';
            announce('Copied');
          } else {
            label.textContent = 'Copy failed';
            announce('Copy failed. Select the code and press Ctrl+C.');
          }
          timer = setTimeout(function () {
            button.removeAttribute('data-copied');
            label.textContent = 'Copy';
          }, 2500);
        });
      });
    });
  }

  // ------------------------------------------------------------ "On this page" scroll-spy
  function initScrollSpy() {
    var headings = [].slice.call(document.querySelectorAll('.doc h2[id], .doc h3[id]'));
    if (!headings.length) return;
    var tocLinks = {};
    [].forEach.call(document.querySelectorAll('.toc-list a[href^="#"]'), function (a) {
      tocLinks[a.getAttribute('href').slice(1)] = a;
    });
    var navLinks = {};
    [].forEach.call(document.querySelectorAll('.nav-page-link[aria-current="page"] + .nav-sections a'), function (a) {
      navLinks[a.getAttribute('href').slice(1)] = a;
    });
    var sectionOf = {};
    var h2 = null;
    headings.forEach(function (h) { if (h.tagName === 'H2') h2 = h.id; sectionOf[h.id] = h2 || h.id; });
    var header = document.querySelector('.site-header');
    var sidebar = document.getElementById('sidebar');
    var toc = document.querySelector('.toc');
    var active = null;
    var pinned = null;   // the heading the reader navigated to, if any
    var settled = true;  // false while a jump's (smooth) scroll is still travelling
    var settleTimer = null;
    var queued = false;

    function mark(map, id) {
      Object.keys(map).forEach(function (key) {
        if (key === id) map[key].setAttribute('aria-current', 'true');
        else map[key].removeAttribute('aria-current');
      });
    }

    // Keep the marked link inside its own column's scroll view. Only that
    // column scrolls: scrollIntoView() would move the page as well.
    function reveal(box, link) {
      if (!box || !link || box.scrollHeight <= box.clientHeight + 1) return;
      var b = box.getBoundingClientRect();
      var r = link.getBoundingClientRect();
      if (!b.height || !r.height) return;
      var margin = 48;
      if (r.top < b.top + margin || r.bottom > b.bottom - margin) {
        box.scrollTop += (r.top - b.top) - (b.height - r.height) / 2;
      }
    }

    function set(id) {
      if (id === active) return;
      active = id;
      mark(tocLinks, id);
      mark(navLinks, sectionOf[id]);
      reveal(sidebar, navLinks[sectionOf[id]]);
      reveal(toc, tocLinks[id]);
    }

    function headingFor(hash) {
      if (!hash || hash.length < 2) return null;
      var el = document.getElementById(decodeURIComponent(hash.slice(1)));
      return el && sectionOf[el.id] ? el : null;
    }

    function pick() {
      queued = false;
      var top = header ? header.getBoundingClientRect().bottom : 0;
      var line = top + (window.innerHeight - top) * 0.3;
      var current = headings[0];
      for (var i = 0; i < headings.length; i += 1) {
        if (headings[i].getBoundingClientRect().top <= line) current = headings[i];
        else break;
      }
      // A heading the reader jumped to (contents link, sidebar link, #hash in
      // the URL) stays current while it sits in the top reading zone, even when
      // its first subsection is close enough to cross the line too.
      if (pinned) {
        var p = pinned.getBoundingClientRect().top;
        if (p >= top - 8 && p <= line) current = pinned;
        else if (p < top - 8 || settled) pinned = null;
      }
      var scroller = document.scrollingElement || root;
      var atBottom = window.innerHeight + window.scrollY >= scroller.scrollHeight - 2;
      if (atBottom && window.scrollY > 0) {
        var lastHeading = headings[headings.length - 1];
        if (pinned && pinned.getBoundingClientRect().top < window.innerHeight) current = pinned;
        else if (lastHeading.getBoundingClientRect().top < window.innerHeight) current = lastHeading;
      }
      set(current.id);
    }

    function queue() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(pick);
    }

    function pin(el) {
      pinned = el;
      settled = false;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { settled = true; queue(); }, 1000);
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var target = headingFor(a.getAttribute('href'));
      if (target) pin(target);
    });

    window.addEventListener('hashchange', function () {
      var target = headingFor(window.location.hash);
      if (target) pin(target);
      queue();
    });

    var initial = headingFor(window.location.hash);
    if (initial) pin(initial);

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    pick();
  }

  // ------------------------------------------------------------ code that scrolls sideways
  // A block wider than its box gets data-scroll="left|right" (the CSS fades
  // that edge) and becomes a named, focusable group so keyboards can scroll it.
  function initCodeScroll() {
    var pres = [].slice.call(document.querySelectorAll('.code-block pre'));
    function update(pre) {
      var max = pre.scrollWidth - pre.clientWidth;
      if (max > 1) {
        var sides = [];
        if (pre.scrollLeft > 1) sides.push('left');
        if (pre.scrollLeft < max - 1) sides.push('right');
        pre.setAttribute('data-scroll', sides.join(' '));
        if (!pre.hasAttribute('tabindex')) {
          var label = pre.parentNode.querySelector('.code-label');
          pre.setAttribute('tabindex', '0');
          pre.setAttribute('role', 'group');
          pre.setAttribute('aria-label', (label ? label.textContent : 'Code') + ' (scrolls sideways)');
        }
      } else if (pre.hasAttribute('data-scroll')) {
        pre.removeAttribute('data-scroll');
        pre.removeAttribute('tabindex');
        pre.removeAttribute('role');
        pre.removeAttribute('aria-label');
      }
    }
    pres.forEach(function (pre) {
      pre.addEventListener('scroll', function () { update(pre); }, { passive: true });
      update(pre);
    });
    window.addEventListener('resize', function () { pres.forEach(update); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    initDrawer();
    initFilter();
    initCopy();
    initScrollSpy();
    initCodeScroll();
  });
})();
