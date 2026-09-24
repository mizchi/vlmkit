/* 汐見窯 product page — gallery, options, cart drawer, disclosures.
   Classic script (works from file://). Deterministic: no dates, no randomness. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  var GLAZES = { seiji: '青磁', hakuji: '白磁', ameyu: '飴釉' };
  var SIZES = { S: 'S 240ml', M: 'M 320ml' };
  var VIEW_TEXT = {
    front: 'を正面から見た姿',
    side: 'を持ち手の側から見た姿',
    top: 'の内側を上から見た姿',
    use: 'にほうじ茶を注ぎ、木の机に置いた様子'
  };
  var PRICE = 4180;
  var FREE_SHIPPING = 5000;
  var QTY_MIN = 1;
  var QTY_MAX = 10;
  var STOCK = 3;

  var state = { glaze: 'seiji', size: 'S', qty: 1, view: 'front', cart: [] };

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function yen(n) { return '¥' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function productName(g) { return '汐見窯 マグカップ ' + GLAZES[g]; }
  function isShown(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) &&
      getComputedStyle(el).visibility !== 'hidden';
  }

  /* ---------- glaze & size ---------- */
  function setGlaze(g) {
    if (!GLAZES[g]) return;
    state.glaze = g;
    root.setAttribute('data-glaze', g);
    $all('[data-glaze-name]').forEach(function (el) { el.textContent = GLAZES[g]; });
    $all('.view').forEach(function (panel) {
      var v = panel.id.replace('panel-', '');
      var svg = $('svg', panel);
      if (svg && VIEW_TEXT[v]) svg.setAttribute('aria-label', productName(g) + VIEW_TEXT[v]);
    });
    doc.title = productName(g) + ' | 汐見窯 オンラインショップ';
    var radio = $('input[name="glaze"][value="' + g + '"]');
    if (radio && !radio.checked) radio.checked = true;
  }
  function setSize(s) {
    if (!SIZES[s]) return;
    state.size = s;
    $all('[data-size-name]').forEach(function (el) { el.textContent = SIZES[s]; });
    var radio = $('input[name="size"][value="' + s + '"]');
    if (radio && !radio.checked) radio.checked = true;
  }
  $all('input[name="glaze"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) setGlaze(r.value); });
  });
  $all('input[name="size"]').forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) setSize(r.value); });
  });

  /* ---------- gallery (tabs: automatic activation, roving tabindex) ---------- */
  var tabs = $all('.thumbs [role="tab"]');
  function setView(v, focus) {
    if (!VIEW_TEXT[v]) return;
    state.view = v;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-view') === v;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = doc.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
      if (on && focus) t.focus();
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { setView(t.getAttribute('data-view')); });
    t.addEventListener('keydown', function (e) {
      var n = tabs.length;
      var j = -1;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': j = (i + 1) % n; break;
        case 'ArrowLeft': case 'ArrowUp': j = (i - 1 + n) % n; break;
        case 'Home': j = 0; break;
        case 'End': j = n - 1; break;
        default: return;
      }
      e.preventDefault();
      setView(tabs[j].getAttribute('data-view'), true);
    });
  });

  /* ---------- quantity (APG spinbutton on a text field, so full-width digits work) ---------- */
  var qty = $('#qty');
  var dec = $('#qty-dec');
  var inc = $('#qty-inc');
  var qtyNote = $('#qty-note');
  function toHalfWidth(s) {
    return String(s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }
  function setQty(n) {
    n = parseInt(toHalfWidth(n), 10);
    if (isNaN(n)) n = state.qty;
    n = Math.max(QTY_MIN, Math.min(QTY_MAX, n));
    state.qty = n;
    qty.value = String(n);
    qty.setAttribute('aria-valuenow', String(n));
    qty.setAttribute('aria-valuetext', n + '点');
    dec.setAttribute('aria-disabled', n <= QTY_MIN ? 'true' : 'false');
    inc.setAttribute('aria-disabled', n >= QTY_MAX ? 'true' : 'false');
    qtyNote.textContent = n > STOCK
      ? '在庫は残り' + STOCK + '点です。' + (STOCK + 1) + '点目からは受注制作となり、お届けまで約3週間いただきます。'
      : '';
  }
  // The buttons keep focus, so say the new value (or why nothing changed) in a status line.
  var qtyStatus = $('#qty-status');
  function step(delta) {
    var next = state.qty + delta;
    if (next < QTY_MIN) { qtyStatus.textContent = '数量は' + QTY_MIN + '点からです'; return; }
    if (next > QTY_MAX) { qtyStatus.textContent = '数量は' + QTY_MAX + '点までです'; return; }
    setQty(next);
    qtyStatus.textContent = '数量 ' + next + '点';
  }
  dec.addEventListener('click', function () { step(-1); });
  inc.addEventListener('click', function () { step(1); });
  qty.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') { e.preventDefault(); setQty(state.qty + 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setQty(state.qty - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setQty(QTY_MIN); }
    else if (e.key === 'End') { e.preventDefault(); setQty(QTY_MAX); }
    else if (e.key === 'Enter') { setQty(qty.value); }
  });
  qty.addEventListener('input', function (e) {
    if (e.isComposing) return;
    var cleaned = toHalfWidth(qty.value).replace(/[^0-9]/g, '');
    if (cleaned !== qty.value) qty.value = cleaned;
  });
  qty.addEventListener('compositionend', function () {
    qty.value = toHalfWidth(qty.value).replace(/[^0-9]/g, '');
  });
  qty.addEventListener('change', function () { setQty(qty.value); });

  /* ---------- favourite toggle ---------- */
  var fav = $('#fav');
  var favStatus = $('#fav-status');
  fav.addEventListener('click', function () {
    var on = fav.getAttribute('aria-pressed') !== 'true';
    fav.setAttribute('aria-pressed', on ? 'true' : 'false');
    favStatus.textContent = on ? 'お気に入りに追加しました' : 'お気に入りから外しました';
  });

  /* ---------- cart ---------- */
  var cart = state.cart;
  var drawer = $('#cart-drawer');
  var cartBtn = $('#cart-open');
  var countEl = $('#cart-count');
  var badge = $('[data-cart-badge]');
  var linesEl = $('#cart-lines');
  var emptyEl = $('#cart-empty');
  var footEl = $('#cart-foot');
  var subtotalEl = $('#cart-subtotal');
  var shipText = $('#ship-text');
  var shipFill = $('#ship-bar-fill');
  var statusEl = $('#cart-status');
  var checkoutNote = $('#checkout-note');
  var closeBtn = $('#cart-close');
  var lastTrigger = null;

  function cartCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  function renderCart() {
    var count = cartCount();
    var total = count * PRICE;
    countEl.textContent = String(count);
    badge.classList.toggle('has-items', count > 0);
    linesEl.textContent = '';
    cart.forEach(function (line, idx) {
      var li = doc.createElement('li');
      li.className = 'cart-line';
      li.innerHTML =
        '<span class="cart-thumb glaze-' + line.glaze + '"><svg viewBox="0 0 600 600" aria-hidden="true" focusable="false"><use href="#view-front"></use></svg></span>' +
        '<div class="cart-info">' +
          '<p class="cart-name">' + productName(line.glaze) + '</p>' +
          '<dl class="cart-attrs">' +
            '<div><dt>釉薬</dt><dd>' + GLAZES[line.glaze] + '</dd></div>' +
            '<div><dt>サイズ</dt><dd>' + SIZES[line.size] + '</dd></div>' +
            '<div><dt>数量</dt><dd>' + line.qty + '</dd></div>' +
          '</dl>' +
          '<button type="button" class="cart-remove" data-index="' + idx + '">削除<span class="sr-only">：' +
            GLAZES[line.glaze] + ' ' + SIZES[line.size] + '</span></button>' +
        '</div>' +
        '<p class="cart-price">' + yen(line.qty * PRICE) + '</p>';
      linesEl.appendChild(li);
    });
    var empty = cart.length === 0;
    emptyEl.hidden = !empty;
    footEl.hidden = empty;
    subtotalEl.textContent = yen(total);
    if (total >= FREE_SHIPPING) {
      shipText.textContent = '送料無料の対象です。';
      shipFill.style.width = '100%';
    } else {
      shipText.textContent = 'あと' + yen(FREE_SHIPPING - total) + 'で送料無料になります。';
      shipFill.style.width = (total / FREE_SHIPPING * 100).toFixed(1) + '%';
    }
  }

  function openDrawer(trigger) {
    lastTrigger = trigger || doc.activeElement;
    checkoutNote.textContent = '';
    if (!drawer.open) {
      if (typeof drawer.showModal === 'function') drawer.showModal();
      else drawer.setAttribute('open', '');
    }
    closeBtn.focus();
  }
  function closeDrawer() {
    if (drawer.open) drawer.close();
  }
  function addToCart(trigger) {
    var found = null;
    cart.forEach(function (l) { if (l.glaze === state.glaze && l.size === state.size) found = l; });
    if (found) found.qty = Math.min(found.qty + state.qty, 99);
    else cart.push({ glaze: state.glaze, size: state.size, qty: state.qty });
    renderCart();
    statusEl.textContent = 'カートに追加しました（' + GLAZES[state.glaze] + '・' + SIZES[state.size] + '・' + state.qty + '点）';
    openDrawer(trigger);
  }

  $all('[data-add-to-cart]').forEach(function (b) {
    b.addEventListener('click', function () { addToCart(b); });
  });
  cartBtn.addEventListener('click', function () {
    statusEl.textContent = '';
    openDrawer(cartBtn);
  });
  drawer.addEventListener('close', function () {
    statusEl.textContent = '';
    var target = lastTrigger;
    if (!target || !doc.contains(target) || !isShown(target)) target = cartBtn;
    target.focus();
  });
  drawer.addEventListener('click', function (e) {
    if (e.target === drawer) closeDrawer();  // a click on the backdrop
  });
  $all('[data-close]', drawer).forEach(function (b) { b.addEventListener('click', closeDrawer); });
  linesEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.cart-remove');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-index'), 10);
    cart.splice(idx, 1);
    renderCart();
    statusEl.textContent = '商品をカートから削除しました';
    var rest = linesEl.querySelectorAll('.cart-remove');
    (rest[Math.min(idx, rest.length - 1)] || closeBtn).focus();
  });
  $('#checkout').addEventListener('click', function () {
    checkoutNote.textContent = 'デモのため、お支払いの手続きには進みません。';
  });

  /* ---------- pinned bar: hidden while the panel's own button is on screen ---------- */
  var buybar = $('#buybar');
  var mainCta = $('#add-to-cart');
  if (buybar && mainCta && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { buybar.classList.toggle('is-hidden', en.isIntersecting); });
    }, { rootMargin: '0px 0px -80px 0px' }).observe(mainCta);
  }

  /* ---------- accordion ---------- */
  $all('.acc-trigger').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', open ? 'false' : 'true');
      var panel = doc.getElementById(b.getAttribute('aria-controls'));
      if (panel) panel.hidden = open;
    });
  });

  /* ---------- more reviews ---------- */
  var moreBtn = $('#more-btn');
  var more = $('#more-reviews');
  moreBtn.addEventListener('click', function () {
    var open = moreBtn.getAttribute('aria-expanded') === 'true';
    moreBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    more.hidden = open;
    $('.more-label', moreBtn).textContent = open ? 'もっと見る' : '閉じる';
  });

  /* ---------- search ---------- */
  var searchBtn = $('#search-toggle');
  var searchPanel = $('#search-panel');
  var searchInput = $('#search-input');
  var searchNote = $('#search-note');
  function setSearch(open, returnFocus) {
    searchBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    searchPanel.hidden = !open;
    if (open) searchInput.focus();
    else {
      searchNote.textContent = '';
      if (returnFocus) searchBtn.focus();
    }
  }
  searchBtn.addEventListener('click', function () {
    setSearch(searchBtn.getAttribute('aria-expanded') !== 'true');
  });
  searchPanel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); setSearch(false, true); }
  });
  $('#search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = searchInput.value.trim();
    searchNote.textContent = q
      ? '「' + q + '」の検索結果は、デモのため表示されません。'
      : 'キーワードを入力してください。';
  });

  /* ---------- newsletter ---------- */
  var nlForm = $('#nl-form');
  var nlEmail = $('#nl-email');
  var nlMsg = $('#nl-msg');
  nlForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = nlEmail.value.trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    nlEmail.setAttribute('aria-invalid', ok ? 'false' : 'true');
    nlMsg.classList.toggle('is-error', !ok);
    nlMsg.textContent = ok
      ? 'ご登録ありがとうございます。次回の汐見窯だよりからお届けします（デモのため送信は行われません）。'
      : (v ? 'メールアドレスの形式をご確認ください。' : 'メールアドレスを入力してください。');
    if (ok) nlEmail.value = '';
  });
  nlEmail.addEventListener('input', function () {
    // Once corrected, the error clears as the user types rather than on the next submit.
    if (nlEmail.getAttribute('aria-invalid') === 'true' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nlEmail.value.trim())) {
      nlEmail.setAttribute('aria-invalid', 'false');
      nlMsg.classList.remove('is-error');
      nlMsg.textContent = '';
    }
  });

  /* ---------- initial state (URL parameters, or what the browser restored) ---------- */
  var params = new URLSearchParams(location.search);
  var checkedGlaze = $('input[name="glaze"]:checked');
  var checkedSize = $('input[name="size"]:checked');
  setGlaze(params.get('glaze') || (checkedGlaze && checkedGlaze.value) || 'seiji');
  setSize(params.get('size') || (checkedSize && checkedSize.value) || 'S');
  setView(params.get('view') || 'front');
  setQty(1);
  renderCart();
})();
