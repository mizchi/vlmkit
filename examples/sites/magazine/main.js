/* ほとり — reading progress, search, copy link, save. Classic script, no modules, no network. */
(function () {
  'use strict';

  var root = document.documentElement;
  var params = new URLSearchParams(window.location.search);
  if (params.get('animate') === '0') root.setAttribute('data-animate', 'off');

  /* ---------------------------------------------------------- reading progress */
  var story = document.getElementById('story');
  var bar = document.getElementById('progress-bar');
  var queued = false;

  function paintProgress() {
    queued = false;
    var rect = story.getBoundingClientRect();
    var span = rect.height - window.innerHeight;
    var read = -rect.top;
    var p = span > 0 ? read / span : (rect.top <= 0 ? 1 : 0);
    p = Math.max(0, Math.min(1, p));
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  function queueProgress() {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(paintProgress);
    }
  }
  paintProgress();
  // The easing only smooths the reader's own scrolling, so it is switched on by the
  // reader's first interaction, not on load. A page that opens mid-article (a #note
  // link, a restored scroll position) is scrolled by the browser after this script
  // runs; with the easing still off, the bar jumps straight to its place.
  var FIRST_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  function enableEasing() {
    root.classList.add('is-ready');
    FIRST_INPUT.forEach(function (type) {
      window.removeEventListener(type, enableEasing, true);
    });
  }
  FIRST_INPUT.forEach(function (type) {
    window.addEventListener(type, enableEasing, { capture: true, passive: true });
  });
  window.addEventListener('scroll', queueProgress, { passive: true });
  window.addEventListener('resize', queueProgress);

  /* ---------------------------------------------------------- search */
  var ARTICLES = [
    { title: '海辺の町の古本屋が、夜だけ店を開ける理由', section: '本', date: '2026年9月12日', href: '#story-title' },
    { title: '岬の貸本屋に、手紙で本を頼む', section: '本', date: '2026年8月8日', href: '#related-1' },
    { title: '終点の駅から、灯台まで歩く', section: '旅', date: '2026年7月25日', href: '#related-2' },
    { title: '潮風と暮らす家の、窓のしつらえ', section: '暮らし', date: '2026年6月30日', href: '#related-3' }
  ];
  var toggle = document.getElementById('search-toggle');
  var panel = document.getElementById('search-panel');
  var form = document.getElementById('search-form');
  var input = document.getElementById('search-input');
  var status = document.getElementById('search-status');
  var results = document.getElementById('search-results');

  function setSearch(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    if (open) input.focus();
  }
  toggle.addEventListener('click', function () {
    setSearch(toggle.getAttribute('aria-expanded') !== 'true');
  });
  panel.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setSearch(false);
      toggle.focus();
    }
  });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var q = input.value.trim();
    results.textContent = '';
    if (!q) {
      status.textContent = 'キーワードを入力してください。';
      return;
    }
    var hits = ARTICLES.filter(function (a) {
      return a.title.indexOf(q) !== -1 || a.section === q;
    });
    status.textContent = hits.length
      ? '「' + q + '」に一致する記事が' + hits.length + '件あります。'
      : '「' + q + '」に一致する記事は見つかりませんでした。';
    hits.forEach(function (a) {
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = a.href;
      link.textContent = a.title + '（' + a.section + '・' + a.date + '）';
      li.appendChild(link);
      results.appendChild(li);
    });
  });

  /* ---------------------------------------------------------- copy link */
  var copyButton = document.getElementById('copy-link');
  var shareStatus = document.getElementById('share-status');
  var COPIED = 'リンクをコピーしました';
  var FAILED = 'コピーできませんでした。アドレスバーのURLをお使いください。';

  function say(message) {
    if (shareStatus.textContent === message) {
      // Same message twice: clear first so assistive technology announces it again.
      shareStatus.textContent = '';
      window.setTimeout(function () { shareStatus.textContent = message; }, 120);
    } else {
      shareStatus.textContent = message;
    }
  }
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    copyButton.focus();
    return ok;
  }
  copyButton.addEventListener('click', function () {
    var url = window.location.href.replace(/#.*$/, '');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () {
        say(COPIED);
      }, function () {
        say(legacyCopy(url) ? COPIED : FAILED);
      });
    } else {
      say(legacyCopy(url) ? COPIED : FAILED);
    }
  });

  /* ---------------------------------------------------------- save */
  var save = document.getElementById('save');
  save.addEventListener('click', function () {
    save.setAttribute('aria-pressed', save.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });
})();
