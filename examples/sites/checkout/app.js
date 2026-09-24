/* Pantry Club checkout — demo behaviour. No network, no storage, no clock:
   every date and number shown comes from the constants below. */
(function () {
  "use strict";

  var PLANS = {
    "2p3m": { people: "2 people", meals: "3 meals a week", servings: 6, price: 5994 },
    "4p3m": { people: "4 people", meals: "3 meals a week", servings: 12, price: 10788 },
    "2p5m": { people: "2 people", meals: "5 meals a week", servings: 10, price: 9490 }
  };
  Object.keys(PLANS).forEach(function (k) {
    PLANS[k].name = PLANS[k].people + " · " + PLANS[k].meals;
  });

  /* First box: the chosen weekday in the week of October 12, 2026. */
  var DAYS = {
    mon: { name: "Monday", short: "Mon, Oct 12", long: "Monday, October 12", full: "Monday, October 12, 2026" },
    tue: { name: "Tuesday", short: "Tue, Oct 13", long: "Tuesday, October 13", full: "Tuesday, October 13, 2026" },
    wed: { name: "Wednesday", short: "Wed, Oct 14", long: "Wednesday, October 14", full: "Wednesday, October 14, 2026" },
    thu: { name: "Thursday", short: "Thu, Oct 15", long: "Thursday, October 15", full: "Thursday, October 15, 2026" },
    fri: { name: "Friday", short: "Fri, Oct 16", long: "Friday, October 16", full: "Friday, October 16, 2026" },
    sat: { name: "Saturday", short: "Sat, Oct 17", long: "Saturday, October 17", full: "Saturday, October 17, 2026" }
  };

  var PROMO_CODE = "WELCOME10";
  var PROMO_PERCENT = 10;
  var TAX_PERCENT = 8;
  var ORDER_NUMBER = "PC-20417";
  /* Cards expiring before this month are refused (the demo's fixed "today"). */
  var EXPIRY_FLOOR = { year: 26, month: 10 };

  var TITLES = { 1: "Choose your plan", 2: "Delivery details", 3: "Payment", 4: "Review your order" };

  var state = {
    step: 1,
    done: {},
    attempted: {},
    returnToReview: false,
    promo: null
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var forms = $$("form.step");
  var formByStep = {};
  forms.forEach(function (f) { formByStep[f.dataset.step] = f; });

  var el = {
    steps: $("#steps"),
    stepItems: $$("#steps .steps__item"),
    summary: $("#summary"),
    toggle: $("#summary-toggle"),
    toggleText: $("#summary-toggle-text"),
    promoLine: $("#summary-promo"),
    day: $("#day"),
    dayNote: $("#day-note"),
    instructions: $("#instructions"),
    counter: $("#instructions-count"),
    counterLive: $("#instructions-live"),
    card: $("#card-number"),
    expiry: $("#expiry"),
    cvc: $("#cvc"),
    zip: $("#zip"),
    billingZip: $("#billing-zip"),
    billingSame: $("#billing-same"),
    billingFields: $("#billing-fields"),
    billingState: $("#billing-state"),
    state: $("#state"),
    promo: $("#promo"),
    promoButton: $("#promo-apply"),
    promoMessage: $("#promo-message"),
    terms: $("#terms"),
    confirmation: $("#confirmation")
  };

  /* The billing state list is the delivery list, copied once. */
  el.billingState.innerHTML = el.state.innerHTML;

  /* ---------- Helpers ---------- */

  function money(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  function minus(cents) {
    return "−" + money(cents);
  }

  function val(name) {
    var node = document.getElementsByName(name)[0];
    return node ? String(node.value || "").trim() : "";
  }

  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function planKey() {
    var checked = $('input[name="plan"]:checked');
    return checked ? checked.value : "2p3m";
  }

  function diets() {
    return $$('input[name="diet"]:checked').map(function (c) { return c.value; });
  }

  function totals() {
    var plan = PLANS[planKey()];
    var sub = plan.price;
    var discount = state.promo ? Math.round((sub * PROMO_PERCENT) / 100) : 0;
    var taxable = sub - discount;
    var tax = Math.round((taxable * TAX_PERCENT) / 100);
    var renewal = sub + Math.round((sub * TAX_PERCENT) / 100);
    return { plan: plan, sub: sub, discount: discount, tax: tax, total: taxable + tax, renewal: renewal };
  }

  function stateName(select) {
    var opt = select.options[select.selectedIndex];
    return opt && opt.value ? opt.value : "";
  }

  function addressLines(prefix) {
    var p = prefix || "";
    var line1 = val(p ? "billingAddress1" : "address1");
    var line2 = val(p ? "billingAddress2" : "address2");
    var city = val(p ? "billingCity" : "city");
    var st = stateName(p ? el.billingState : el.state);
    var zip = val(p ? "billingZip" : "zip");
    var place = [city, [st, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return [line1, line2, place].filter(Boolean);
  }

  /* ---------- Output binding ---------- */

  function out(key, text) {
    $$('[data-out="' + key + '"]').forEach(function (node) { node.textContent = text; });
  }

  /* Phrases kept whole where they fit ("2 people ·", "Portland, OR 97214"):
     each is an inline-block carrying its own trailing separator, so a line
     can break only between phrases, after the "·" or ",". A phrase wider
     than its box still wraps inside itself instead of overflowing. */
  function outPhrases(key, phrases, separator) {
    var mark = separator || "·";
    $$('[data-html="' + key + '"]').forEach(function (node) {
      node.textContent = "";
      phrases.forEach(function (phrase, i) {
        if (i) node.appendChild(document.createTextNode(" "));
        var span = document.createElement("span");
        span.className = "nw";
        span.textContent = i < phrases.length - 1 ? phrase + (mark === "," ? "," : " " + mark) : phrase;
        node.appendChild(span);
      });
    });
  }

  function outLines(key, lines) {
    $$('[data-out="' + key + '"]').forEach(function (node) {
      node.textContent = "";
      lines.forEach(function (line, i) {
        if (i) node.appendChild(document.createElement("br"));
        node.appendChild(document.createTextNode(line));
      });
    });
  }

  function updateSummary() {
    var t = totals();
    var plan = t.plan;
    var perServing = Math.round(plan.price / plan.servings);
    var day = DAYS[el.day.value];
    var chosen = diets();

    out("planName", plan.name);
    outPhrases("planNameHtml", [plan.people, plan.meals]);
    outPhrases("planMetaHtml", [plan.servings + " servings", money(perServing) + " each"]);
    out("subtotal", money(t.sub));
    out("discount", minus(t.discount));
    out("tax", money(t.tax));
    out("total", money(t.total));
    out("renewal", money(t.renewal));
    out("renewalNote", "Then " + money(t.renewal) + " a week, tax included. Skip a week or cancel any time.");
    out("dietsShort", chosen.length ? chosen.join(", ") : "None");
    out("firstDeliveryShort", day ? day.short : "Pick a day");
    out("firstDeliveryLong", day ? day.long : "");
    out("firstDeliveryFull", day ? day.full : "");
    el.promoLine.hidden = !state.promo;
    el.dayNote.hidden = !day;

    outPhrases("addressPhrases", addressLines(), ",");

    if (state.promo) {
      showPromoMessage("success", PROMO_CODE + " applied: 10% off your first box (" + minus(t.discount) + ").");
    }
  }

  function renderReview() {
    var t = totals();
    var day = DAYS[el.day.value];
    var chosen = diets();
    out("planLine", t.plan.name + ", " + money(t.sub) + " a week");
    out("dietsLong", chosen.length ? chosen.join(", ") : "No preferences");
    out("dayLine", day ? day.name + "s, first box " + day.long : "");
    out("fullName", val("fullName"));
    out("email", val("email"));
    outLines("contact", [val("email"), val("phone")].filter(Boolean));
    outLines("addressBlock", addressLines());
    out("instructionsLine", val("instructions") || "None");
    var num = digits(val("cardNumber"));
    outLines("cardLine", ["Card ending " + num.slice(-4) + ", expires " + val("expiry"), val("cardName")]);
    if (el.billingSame.checked) {
      out("billingLine", "Same as delivery address");
    } else {
      outLines("billingLine", addressLines("billing"));
    }
    out("promoLine", state.promo ? state.promo + " (" + minus(t.discount) + ")" : "None");
  }

  /* ---------- Validation ---------- */

  function required(message) {
    return function (v) { return v ? "" : message; };
  }

  function zipRule(emptyMessage) {
    return function (v) {
      if (!v) return emptyMessage;
      return /^\d{5}(-\d{4})?$/.test(v) ? "" : "Enter a 5-digit ZIP code, like 97214";
    };
  }

  function luhn(num) {
    var sum = 0;
    for (var i = 0; i < num.length; i++) {
      var d = +num.charAt(num.length - 1 - i);
      if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    }
    return sum % 10 === 0;
  }

  var RULES = {
    day: required("Select a delivery day"),
    fullName: required("Enter your full name"),
    email: function (v) {
      if (!v) return "Enter your email address";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Enter an email address like name@example.com";
    },
    phone: function (v) {
      if (!v) return "";
      var d = digits(v);
      if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
      return d.length === 10 ? "" : "Enter a 10-digit phone number, or leave it blank";
    },
    address1: required("Enter the first line of your address"),
    city: required("Enter your city"),
    state: required("Select your state"),
    zip: zipRule("Enter your ZIP code"),
    cardNumber: function (v) {
      if (!v) return "Enter your card number";
      var d = digits(v);
      return d.length >= 13 && d.length <= 19 && luhn(d) ? "" : "Enter a valid card number, like 4242 4242 4242 4242";
    },
    expiry: function (v) {
      if (!v) return "Enter the expiry date";
      var m = /^(\d{2})\/(\d{2})$/.exec(v);
      if (!m) return "Enter the expiry date as MM/YY, like 08/28";
      var mm = +m[1];
      var yy = +m[2];
      if (mm < 1 || mm > 12) return "Enter a month from 01 to 12";
      if (yy < EXPIRY_FLOOR.year || (yy === EXPIRY_FLOOR.year && mm < EXPIRY_FLOOR.month)) {
        return "This card has expired. Check the date or use another card";
      }
      return "";
    },
    cvc: function (v) {
      if (!v) return "Enter the security code";
      return /^\d{3,4}$/.test(v) ? "" : "Enter the 3- or 4-digit security code";
    },
    cardName: required("Enter the name shown on your card"),
    billingAddress1: required("Enter the first line of the billing address"),
    billingCity: required("Enter the billing city"),
    billingState: required("Select the billing state"),
    billingZip: zipRule("Enter the billing ZIP code"),
    promo: function (v) {
      if (!v || state.promo) return "";
      return v.toUpperCase() === PROMO_CODE ? "" : promoInvalidMessage(v);
    },
    terms: function () {
      return el.terms.checked ? "" : "Tick the box to agree to the subscription terms";
    }
  };

  var STEP_FIELDS = {
    1: ["day"],
    2: ["fullName", "email", "phone", "address1", "city", "state", "zip"],
    3: ["cardNumber", "expiry", "cvc", "cardName", "billingAddress1", "billingCity", "billingState", "billingZip", "promo"],
    4: ["terms"]
  };

  function control(name) {
    return document.getElementsByName(name)[0];
  }

  function isActive(name) {
    if (name.indexOf("billing") === 0 && name !== "billingSame") return !el.billingSame.checked;
    return true;
  }

  function messageFor(name) {
    var node = control(name);
    var rule = RULES[name];
    if (!node || !rule || !isActive(name)) return "";
    var v = node.type === "checkbox" ? node.checked : String(node.value || "").trim();
    return rule(v);
  }

  function describedBy(node, id, on) {
    var ids = (node.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
    ids = ids.filter(function (x) { return x !== id; });
    if (on) ids.push(id);
    if (ids.length) node.setAttribute("aria-describedby", ids.join(" "));
    else node.removeAttribute("aria-describedby");
  }

  function setFieldError(name, message) {
    if (name === "promo") {
      setPromoError(message);
      return;
    }
    var node = control(name);
    var field = node.closest(".field");
    var errId = node.id + "-error";
    var err = document.getElementById(errId);
    if (message) {
      if (!err) {
        err = document.createElement("p");
        err.className = "field__error";
        err.id = errId;
        err.innerHTML = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-alert"></use></svg>' +
          '<span><span class="visually-hidden">Error: </span><span class="field__error-text"></span></span>';
        var anchor = node.closest(".select, .choice") || node;
        anchor.insertAdjacentElement("afterend", err);
      }
      err.querySelector(".field__error-text").textContent = message;
      node.setAttribute("aria-invalid", "true");
      describedBy(node, errId, true);
      if (field) field.classList.add("is-invalid");
    } else {
      if (err) err.remove();
      node.removeAttribute("aria-invalid");
      describedBy(node, errId, false);
      if (field) field.classList.remove("is-invalid");
    }
  }

  function stepErrors(step) {
    return STEP_FIELDS[step].map(function (name) {
      return { name: name, message: messageFor(name) };
    }).filter(function (e) { return e.message; });
  }

  function renderErrorSummary(step, errors) {
    var box = document.getElementById("errors-" + step);
    if (!errors.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    var n = errors.length;
    var title = n === 1 ? "1 field needs your attention" : n + " fields need your attention";
    var items = errors.map(function (e) {
      var node = control(e.name);
      return '<li><a href="#' + node.id + '">' + escapeHtml(e.message) + "</a></li>";
    }).join("");
    box.innerHTML =
      '<h2 class="error-summary__title" id="errors-' + step + '-title">' +
      '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-alert"></use></svg>' + title + "</h2>" +
      '<ul class="error-summary__list">' + items + "</ul>";
    box.hidden = false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* After a step's first Continue, a field re-validates when it is left. */
  function revalidate(name) {
    var step = state.step;
    if (!state.attempted[step] || STEP_FIELDS[step].indexOf(name) === -1) return;
    setFieldError(name, messageFor(name));
    var box = document.getElementById("errors-" + step);
    if (!box.hidden) renderErrorSummary(step, stepErrors(step));
    updateTitle();
  }

  /* ---------- Navigation ---------- */

  function updateStepper() {
    el.stepItems.forEach(function (li) {
      var n = +li.dataset.step;
      var current = n === state.step;
      var done = !!state.done[n] && !current;
      li.classList.toggle("is-current", current);
      li.classList.toggle("is-done", done);
      if (current) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
      $(".steps__state", li).textContent = done ? " (completed)" : "";
    });
  }

  function updateTitle() {
    var box = document.getElementById("errors-" + state.step);
    var prefix = box && !box.hidden ? "Error: " : "";
    document.title = prefix + TITLES[state.step] + " (step " + state.step + " of 4) · Pantry Club";
  }

  function goTo(step, quiet) {
    state.step = step;
    forms.forEach(function (f) { f.hidden = +f.dataset.step !== step; });
    updateSummary();
    if (step === 4) renderReview();
    updateStepper();
    updateTitle();
    if (quiet) return;
    window.scrollTo(0, 0);
    document.getElementById("step-" + step + "-title").focus({ preventScroll: true });
  }

  function focusSummary(step) {
    var box = document.getElementById("errors-" + step);
    box.scrollIntoView({ block: "start" });
    box.focus({ preventScroll: true });
  }

  function placeOrder(quiet) {
    updateSummary();
    renderReview();
    forms.forEach(function (f) { f.hidden = true; });
    el.steps.hidden = true;
    el.confirmation.hidden = false;
    document.title = "Order " + ORDER_NUMBER + " confirmed · Pantry Club";
    if (quiet) return;
    window.scrollTo(0, 0);
    $("#confirmation-title").focus({ preventScroll: true });
  }

  forms.forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var step = +form.dataset.step;
      if (step === 3 && el.promo.value.trim() && !state.promo) tryPromo();
      var errors = stepErrors(step);
      state.attempted[step] = true;
      STEP_FIELDS[step].forEach(function (name) {
        var found = errors.filter(function (e) { return e.name === name; })[0];
        setFieldError(name, found ? found.message : "");
      });
      renderErrorSummary(step, errors);
      if (errors.length) {
        updateTitle();
        focusSummary(step);
        return;
      }
      state.done[step] = true;
      if (step === 4) {
        placeOrder();
        return;
      }
      var next = state.returnToReview ? 4 : step + 1;
      if (next === 4) state.returnToReview = false;
      goTo(next);
    });

    form.addEventListener("focusout", function (event) {
      var name = event.target.name;
      if (!name) return;
      if (pointerHeld) {
        if (pending.indexOf(name) === -1) pending.push(name);
      } else {
        revalidate(name);
      }
    });
  });

  /* A field left by pressing the mouse on something else (Continue, a tile)
     is re-validated only after that click completes. Showing or clearing an
     error moves everything below it; doing that between mousedown and mouseup
     would pull the target out from under the pointer and swallow the click. */
  var pointerHeld = false;
  var pending = [];

  function flushPending() {
    var names = pending;
    pending = [];
    names.forEach(revalidate);
  }

  function releasePointer() {
    if (!pointerHeld) return;
    pointerHeld = false;
    setTimeout(flushPending, 0);
  }

  document.addEventListener("mousedown", function () { pointerHeld = true; }, true);
  /* The click's target is fixed by now, so the layout may move: flush first,
     in the capture phase, so the clicked control sees up-to-date errors. */
  document.addEventListener("click", function () {
    pointerHeld = false;
    flushPending();
  }, true);
  /* A press that ends in no click (a drag, a release elsewhere). */
  document.addEventListener("mouseup", releasePointer, true);
  window.addEventListener("blur", releasePointer);

  $$('[data-action="back"]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (state.step > 1) goTo(state.step - 1);
    });
  });

  $$("[data-edit]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      state.returnToReview = true;
      goTo(+link.dataset.edit);
    });
  });

  /* Error summary links move focus to the field, keeping its label in view. */
  $$(".error-summary").forEach(function (box) {
    box.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (!link) return;
      event.preventDefault();
      var target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      var field = target.closest(".field, .choice") || target;
      field.scrollIntoView({ block: "center" });
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- Live inputs ---------- */

  $$('input[name="plan"], input[name="diet"]').forEach(function (input) {
    input.addEventListener("change", updateSummary);
  });

  el.day.addEventListener("change", function () {
    updateSummary();
    revalidate("day");
  });

  [el.state, el.billingState, el.terms].forEach(function (node) {
    node.addEventListener("change", function () { revalidate(node.name); });
  });

  function renderCounter() {
    var left = 200 - el.instructions.value.length;
    var text = left === 1 ? "1 character left" : left + " characters left";
    el.counter.textContent = text;
    el.counter.classList.toggle("is-low", left <= 20);
    return text;
  }

  /* The visible count updates on every keystroke; screen readers hear it
     once typing pauses, not on every character. */
  var liveTimer = null;
  el.instructions.addEventListener("input", function () {
    var text = renderCounter();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { el.counterLive.textContent = text; }, 800);
  });

  /* Card number: digits only, grouped in fours, caret kept after the same digit. */
  el.card.addEventListener("input", function () {
    var node = el.card;
    var caret = node.selectionStart == null ? node.value.length : node.selectionStart;
    var before = digits(node.value.slice(0, caret)).length;
    var d = digits(node.value).slice(0, 19);
    var formatted = d.replace(/(\d{4})(?=\d)/g, "$1 ");
    node.value = formatted;
    var pos = 0;
    var seen = 0;
    while (pos < formatted.length && seen < before) {
      if (/\d/.test(formatted.charAt(pos))) seen++;
      pos++;
    }
    if (document.activeElement === node) node.setSelectionRange(pos, pos);
  });

  el.expiry.addEventListener("input", function () {
    var d = digits(el.expiry.value).slice(0, 4);
    el.expiry.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  });

  el.cvc.addEventListener("input", function () {
    el.cvc.value = digits(el.cvc.value).slice(0, 4);
  });

  el.billingSame.addEventListener("change", function () {
    var reveal = !el.billingSame.checked;
    el.billingFields.hidden = !reveal;
    $("#billing-preview").hidden = reveal;
    if (!reveal) {
      ["billingAddress1", "billingCity", "billingState", "billingZip"].forEach(function (name) { setFieldError(name, ""); });
      var box = document.getElementById("errors-3");
      if (!box.hidden) renderErrorSummary(3, stepErrors(3));
    }
  });

  /* ---------- Promo code ---------- */

  function promoInvalidMessage(code) {
    return "“" + code.toUpperCase() + "” isn’t a valid promo code. Check the spelling.";
  }

  function showPromoMessage(kind, text) {
    var icon = kind === "success" ? "#i-check-circle" : "#i-alert";
    el.promoMessage.className = "promo__message is-" + kind;
    el.promoMessage.innerHTML = '<svg class="icon" aria-hidden="true" focusable="false"><use href="' + icon + '"></use></svg><span></span>';
    el.promoMessage.lastChild.textContent = text;
  }

  function clearPromoMessage() {
    el.promoMessage.className = "promo__message";
    el.promoMessage.textContent = "";
  }

  function setPromoError(message) {
    if (message) {
      el.promo.setAttribute("aria-invalid", "true");
      showPromoMessage("error", message);
    } else {
      el.promo.removeAttribute("aria-invalid");
      if (!state.promo) clearPromoMessage();
    }
  }

  function tryPromo() {
    var code = el.promo.value.trim();
    if (!code) {
      setPromoError("Enter a promo code first");
      return false;
    }
    if (code.toUpperCase() !== PROMO_CODE) {
      setPromoError(promoInvalidMessage(code));
      return false;
    }
    state.promo = PROMO_CODE;
    el.promo.value = PROMO_CODE;
    el.promo.readOnly = true;
    el.promo.removeAttribute("aria-invalid");
    el.promoButton.textContent = "Remove";
    el.promoButton.setAttribute("aria-label", "Remove promo code " + PROMO_CODE);
    updateSummary();
    return true;
  }

  function removePromo() {
    state.promo = null;
    el.promo.readOnly = false;
    el.promo.value = "";
    el.promoButton.textContent = "Apply";
    el.promoButton.removeAttribute("aria-label");
    showPromoMessage("success", "Promo code removed.");
    updateSummary();
  }

  el.promoButton.addEventListener("click", function () {
    if (state.promo) removePromo();
    else tryPromo();
  });

  el.promo.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!state.promo) tryPromo();
    }
  });

  /* ---------- Phone summary disclosure ---------- */

  el.toggle.addEventListener("click", function () {
    var open = el.toggle.getAttribute("aria-expanded") !== "true";
    el.toggle.setAttribute("aria-expanded", String(open));
    el.summary.classList.toggle("is-open", open);
    el.toggleText.textContent = open ? "Hide order summary" : "Show order summary";
  });

  /* ---------- Deep links: ?step=2|3|4|done ----------
     Opens the checkout part-way through, with the earlier steps filled in
     with this fixed sample customer. A demo and review aid: the flow itself
     always starts at step 1. */

  var SAMPLE = {
    fullName: "Jordan Rivera",
    email: "jordan@example.com",
    address1: "1450 Alder Street",
    address2: "Apt 3",
    city: "Portland",
    zip: "97214",
    instructions: "Leave it on the porch, please.",
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/28",
    cvc: "123",
    cardName: "Jordan Rivera"
  };

  function prefill(upTo) {
    if (upTo > 1) {
      el.day.value = "tue";
      state.done[1] = true;
    }
    if (upTo > 2) {
      ["fullName", "email", "address1", "address2", "city", "zip", "instructions"].forEach(function (name) {
        control(name).value = SAMPLE[name];
      });
      el.state.value = "OR";
      renderCounter();
      state.done[2] = true;
    }
    if (upTo > 3) {
      ["cardNumber", "expiry", "cvc", "cardName"].forEach(function (name) {
        control(name).value = SAMPLE[name];
      });
      state.done[3] = true;
    }
  }

  var start = new URLSearchParams(window.location.search).get("step");

  if (start === "2" || start === "3" || start === "4") {
    prefill(+start);
    goTo(+start, true);
  } else if (start === "done") {
    prefill(4);
    el.terms.checked = true;
    state.done[4] = true;
    placeOrder(true);
  } else {
    updateSummary();
    updateStepper();
  }
})();
