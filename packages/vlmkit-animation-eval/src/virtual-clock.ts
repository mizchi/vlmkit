/**
 * A page clock the evaluator owns: `requestAnimationFrame`, `performance.now`, `Date`,
 * `setTimeout` and `setInterval` all read one virtual time, held at 0 from document start,
 * which only `window.__vlmkitClock.advanceTo(ms)` moves.
 *
 * Why: the Web Animations API is the only motion `check animation` could pause and seek.
 * Everything driven by script — a rAF loop, a GSAP ticker, a canvas, a `setInterval`
 * carousel — kept moving while the gate sampled, so all the gate could say about it was
 * `uncontrolled-motion: mask it or stub the ticker`. This IS the stub. With the clock held,
 * script-driven motion is a function of virtual time like a WAAPI animation's `currentTime`,
 * so it can be sampled, it stops contaminating the WAAPI frames, and whatever still moves
 * under a held clock (video, GIF, a worker) is genuinely uncontrolled.
 *
 * The technique is HyperFrames' (heygen-com/hyperframes, `producer/src/services/fileServer.ts`):
 * a frozen `Date` / `performance.now` and a rAF queue flushed once per seek. Two departures:
 * timers are virtual too (HyperFrames leaves `setTimeout` native — a `setInterval` carousel
 * is the commonest uncontrolled motion on ordinary pages, and a composition is not), and
 * frames advance one 60 fps step at a time, because a loop that integrates its own `dt`
 * lands somewhere else when handed one 500ms jump.
 *
 * What it cannot hold: CSS animations and transitions run on `document.timeline`, which is
 * the WAAPI half the evaluator already pauses; `<video>` / animated images; workers; and
 * `MessageChannel` / promise scheduling, which are not time-based and run natively.
 *
 * Pages that draw on demand can also listen for `vlmkit:seek` — dispatched after every
 * advance with `detail.timeMs` and `detail.waitUntil(promise)` — the same contract as
 * HyperFrames' `hf-seek`, for a canvas or WebGL scene that renders from an explicit time.
 *
 * `pending()` says what is still to come: timers (and how many repeat), the latest one-shot's
 * due time, queued frames, and the `vlmkit:seek` listeners on `window`. `takeLeftAt()` is the
 * page time at which the document began to navigate away, for a caller holding the clock across
 * a navigation (`openHeldTimeline`).
 */
export const VIRTUAL_CLOCK_SCRIPT = `(() => {
  if (window.__vlmkitClock) return;
  const nativePerfNow = performance.now.bind(performance);
  const NativeDate = Date;
  // Virtual 0 is document start; Date keeps the real wall-clock date at that instant.
  const epochAtZero = NativeDate.now() - nativePerfNow();
  let now = 0;
  // Frames are counted, not accumulated: frame n is at (n * 1000) / 60. Adding 1000/60 per frame
  // drifts above the boundary (frame 6 summed to 100.00000000000001), so advanceTo(100) ran 5
  // frames, not 6 — and 500 and 2000, on the --timeline default grid, each missed one.
  let frames = 0;
  const frameTime = (n) => (n * 1000) / 60;
  let seq = 0;
  let rafQueue = [];
  const timers = new Map();

  Object.defineProperty(performance, "now", { value: () => now, configurable: true, writable: true });

  function VirtualDate(...args) {
    if (!new.target) return new NativeDate(epochAtZero + now).toString();
    return args.length === 0 ? new NativeDate(epochAtZero + now) : new NativeDate(...args);
  }
  VirtualDate.prototype = NativeDate.prototype;
  VirtualDate.now = () => Math.floor(epochAtZero + now);
  VirtualDate.parse = NativeDate.parse;
  VirtualDate.UTC = NativeDate.UTC;
  window.Date = VirtualDate;

  window.requestAnimationFrame = (callback) => {
    const id = ++seq;
    rafQueue.push({ id, callback });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((entry) => entry.id !== id);
  };

  // Timer nesting, as the HTML timer initialization steps have it: a timer scheduled while a
  // timer callback runs is one level deeper than that callback's, and one scheduled from deeper
  // than level 5 waits at least 4ms. Chromium 141 on the real clock ran six nested
  // setTimeout(f, 0) at once and each later one ~4ms after the last, and setInterval(f, 0) the
  // same. Unclamped, a self-rescheduling setTimeout(f, 0) was a timer due now at every step:
  // advanceTo spun to its step guard every frame and rAF never ran.
  let level = 0;
  const clamp = (ms, parentLevel) => (parentLevel > 5 && ms < 4 ? 4 : ms);
  const schedule = (callback, delay, args, repeat) => {
    const id = ++seq;
    const ms = Math.max(0, Number(delay) || 0);
    timers.set(id, { due: now + clamp(ms, level), delay: ms, level: level + 1, callback, args, repeat });
    return id;
  };
  window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) => schedule(callback, delay, args, true);
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };

  // The page's vlmkit:seek listeners on window, each (listener, capture) once as the DOM keeps
  // them: a second add of the same pair is a no-op there, and so is one with an aborted signal.
  const SEEK = "vlmkit:seek";
  const seekKeys = new WeakMap();
  // One key object per (listener, capture) pair -> { once } while it is registered.
  const seekListeners = new Map();
  const seekKey = (listener, options) => {
    const capture = typeof options === "boolean" ? options : Boolean(options && options.capture);
    if (!seekKeys.has(listener)) seekKeys.set(listener, [{}, {}]);
    return seekKeys.get(listener)[capture ? 1 : 0];
  };
  const isSeekListener = (self, type, listener) =>
    type === SEEK && (self === window || self == null) &&
    (typeof listener === "function" || (typeof listener === "object" && listener !== null));
  const nativeAdd = window.addEventListener;
  const nativeRemove = window.removeEventListener;
  window.addEventListener = function (type, listener, options) {
    const opts = options && typeof options === "object" ? options : {};
    if (isSeekListener(this, type, listener) && !(opts.signal && opts.signal.aborted)) {
      const key = seekKey(listener, options);
      if (!seekListeners.has(key)) {
        const entry = { once: Boolean(opts.once) };
        seekListeners.set(key, entry);
        if (opts.signal) {
          opts.signal.addEventListener("abort", () => {
            if (seekListeners.get(key) === entry) seekListeners.delete(key);
          }, { once: true });
        }
      }
    }
    return nativeAdd.call(this, type, listener, options);
  };
  window.removeEventListener = function (type, listener, options) {
    if (isSeekListener(this, type, listener)) seekListeners.delete(seekKey(listener, options));
    return nativeRemove.call(this, type, listener, options);
  };

  // The page time a cross-document navigation began at. On Chromium 141 beforeunload is
  // dispatched inside the call that navigates (location.href =, reload(), a link's click()) and
  // not for a same-document one, so a caller holding the clock across the navigation can start
  // the next document's time there.
  let leftAt = null;
  nativeAdd.call(window, "beforeunload", () => { leftAt = now; }, true);

  // A throwing callback must not stop the clock for everything else on the page.
  const errors = [];
  const invoke = (callback, args) => {
    try {
      if (typeof callback === "function") callback(...args);
      else if (typeof callback === "string") (0, eval)(callback);
    } catch (error) {
      errors.push(String((error && error.message) || error));
    }
  };

  const nextTimer = () => {
    let best = null;
    for (const [id, timer] of timers) if (best === null || timer.due < best[1].due) best = [id, timer];
    return best;
  };

  // Microtasks between steps, so a promise chain started by one callback settles before the
  // next callback runs — the order it would have had on a real clock.
  const drain = () => Promise.resolve().then(() => undefined);

  async function advanceTo(target) {
    let guard = 0;
    while (guard++ < 100000) {
      const timer = nextTimer();
      const frameAt = frameTime(frames + 1);
      const timerAt = timer ? timer[1].due : Infinity;
      const at = Math.min(frameAt, timerAt);
      if (at > target) break;
      now = Math.max(now, at);
      if (timer && timerAt <= frameAt) {
        const [id, entry] = timer;
        // An interval's next run is a task of its own, one level deeper than this one.
        const runLevel = entry.level;
        if (entry.repeat) {
          entry.due += clamp(entry.delay, runLevel);
          entry.level = runLevel + 1;
        } else timers.delete(id);
        level = runLevel;
        invoke(entry.callback, entry.args || []);
        // Microtasks the callback queued are part of its task, so what they schedule nests too.
        await drain();
        level = 0;
      } else {
        frames += 1;
        const queue = rafQueue;
        rafQueue = [];
        for (const entry of queue) invoke(entry.callback, [now]);
        await drain();
      }
    }
    now = Math.max(now, target);
    const waits = [];
    window.dispatchEvent(new CustomEvent(SEEK, {
      detail: { timeMs: now, waitUntil: (promise) => { waits.push(promise); } },
    }));
    // A once listener is gone after the dispatch; the DOM drops it without a removeEventListener.
    for (const [key, entry] of seekListeners) if (entry.once) seekListeners.delete(key);
    await Promise.all(waits.map((p) => Promise.resolve(p).catch(() => undefined)));
    await drain();
    return now;
  }

  window.__vlmkitClock = {
    now: () => now,
    advanceTo,
    errors,
    // What is still to come. intervals: how many of the timers repeat; latestTimerMs: the due time
    // of the last one-shot timer, or null; seekListeners: the page's vlmkit:seek listeners on
    // window, so a caller can tell a page that draws on seek from a still one.
    pending: () => {
      let intervals = 0;
      let latestTimerMs = null;
      for (const timer of timers.values()) {
        if (timer.repeat) intervals += 1;
        else if (latestTimerMs === null || timer.due > latestTimerMs) latestTimerMs = timer.due;
      }
      return { timers: timers.size, frames: rafQueue.length, intervals, seekListeners: seekListeners.size, latestTimerMs };
    },
    // The page time at which this document began to navigate away, or null; reading it clears it.
    takeLeftAt: () => {
      const at = leftAt;
      leftAt = null;
      return at;
    },
  };
})()`;

/**
 * Every animation held from the instant it begins, with that instant recorded, so the whole
 * page can be put at one moment of its timeline: `window.__vlmkitSeekTimeline(t)` seeks every
 * held animation to `(t - startAt) * playbackRate`, and `__vlmkitTimelineAnimations()` lists what
 * is held for picking instants. Used by `check integrity --timeline`, `check flash` and the frames
 * capture (`openHeldTimeline`) together with `VIRTUAL_CLOCK_SCRIPT`, which holds the script half
 * of the same moment.
 *
 * What a seek leaves alone: an animation at rate 0 or below, one the page paused (until the page
 * plays it — then it is held again from where it was), one the page finished, and one that is
 * cancelled (setting `currentTime` would revive it). Animations inside open shadow roots are
 * held too (`document.getAnimations()` leaves them out, and their start events are not
 * composed), and SMIL — which runs on each outermost `<svg>`'s own timeline — is paused and put
 * at the same page time with `setCurrentTime`.
 *
 * `startAt` is read off the virtual clock when one is installed (the page time a script that
 * started the animation saw), else `performance.now()`. CSS animations and transitions run on
 * `document.timeline`, which is real time: one that starts at load is caught at `transitionrun`
 * / `animationstart` with the page clock still at 0, and its own `currentTime` already counts
 * its delay, so `t - 0` is right. One a script starts later is caught when the browser next
 * renders, which can be after the virtual clock has moved on — its `startAt` is then late by up
 * to the advance that started it. That bound is the honest limit of seeking CSS by page time.
 */
export const HOLD_TIMELINE_SCRIPT = `(() => {
  if (window.__vlmkitTimeline) return;
  // { anim, startAt, pagePaused, cancelled }: startAt is the page time at which the animation's
  // local time was 0, so at page time t it is at (t - startAt) * playbackRate.
  const held = [];
  window.__vlmkitTimeline = held;
  const entries = new WeakMap();
  const clockNow = () => (window.__vlmkitClock ? window.__vlmkitClock.now() : performance.now());
  const proto = Animation.prototype;
  const nativePause = proto.pause;
  const nativePlay = proto.play;
  const nativeCancel = proto.cancel;
  // Only what runs on the document timeline has a time to seek to: a scroll-driven animation's
  // times are percentages, and pausing one froze a reading-progress bar for good.
  const timeBased = (anim) =>
    typeof DocumentTimeline !== "undefined" && anim.timeline instanceof DocumentTimeline;
  // Where the page clock puts a held animation. A rate of 0 or below is the page's: it stays.
  const place = (h, t) => {
    const rate = h.anim.playbackRate;
    if (!(rate > 0)) return;
    try { h.anim.currentTime = Math.max(0, (t - h.startAt) * rate); } catch {}
  };
  // Held again from where it is now, after the page let it run.
  const takeOver = (h) => {
    const rate = h.anim.playbackRate;
    if (!(rate > 0)) return;
    try { nativePause.call(h.anim); } catch {}
    const current = typeof h.anim.currentTime === "number" ? h.anim.currentTime : 0;
    h.startAt = clockNow() - current / rate;
    h.pagePaused = false;
    h.cancelled = false;
  };
  const hold = (anim) => {
    if (!anim || entries.has(anim) || !timeBased(anim)) return;
    // One the page has already paused (a scrubber, animation-play-state: paused) is the page's,
    // and so is one already finished when found: paused, it would replay from the moment it was
    // found.
    const state = anim.playState;
    const h = { anim, startAt: clockNow(), pagePaused: state === "paused", cancelled: false };
    entries.set(anim, h);
    held.push(h);
    if (state === "running") { try { nativePause.call(anim); } catch {} }
  };
  // The page's own pause and play are seen: a held animation the page pauses is placed at the
  // page's present first (its currentTime is only as fresh as the last seek), then left to the
  // page; one it plays is taken over again from where that leaves it. An animation built with
  // new Animation() is held when the page first plays it.
  proto.pause = function () {
    const h = entries.get(this);
    if (h && !h.pagePaused && !h.cancelled && this.playState !== "idle") {
      place(h, clockNow());
      h.pagePaused = true;
    }
    return nativePause.call(this);
  };
  proto.play = function () {
    const h = entries.get(this);
    if (h && !h.pagePaused && !h.cancelled && this.playState !== "idle") place(h, clockNow());
    const result = nativePlay.call(this);
    if (h) takeOver(h);
    else hold(this);
    return result;
  };
  // animationstart and transitionrun are not composed, so each open shadow root is listened to
  // on its own: the ones a script attaches as it attaches them, declarative ones when found.
  const listening = new WeakSet();
  const onStart = (event) => {
    const target = event.target;
    if (!target || !target.getAnimations) return;
    for (const anim of target.getAnimations()) hold(anim);
  };
  const listen = (root) => {
    if (listening.has(root)) return;
    listening.add(root);
    root.addEventListener("animationstart", onStart, true);
    root.addEventListener("transitionrun", onStart, true);
  };
  listen(document);
  const nativeAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (...args) {
    const root = nativeAttachShadow.apply(this, args);
    if (root && root.mode === "open") listen(root);
    return root;
  };
  const nativeAnimate = Element.prototype.animate;
  Element.prototype.animate = function (...args) {
    const anim = nativeAnimate.apply(this, args);
    hold(anim);
    return anim;
  };
  // document.getAnimations() leaves out shadow trees: every open root, at any depth.
  const openRoots = () => {
    const out = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) { out.push(el.shadowRoot); walk(el.shadowRoot); }
      }
    };
    walk(document);
    return out;
  };
  // SMIL runs on each outermost <svg>'s own timeline, which begins when that svg is inserted
  // (Chromium 141: 0 right after insertion) — at load for one in the page. Each is paused and
  // put at its page time when found, so its startAt is the page time it was found at.
  const SMIL = "animate, animateTransform, animateMotion, set";
  const svgs = [];
  const svgSeen = new WeakSet();
  const placeSvg = (s, t) => {
    try {
      s.svg.pauseAnimations();
      s.svg.setCurrentTime(Math.max(0, t - s.startAt) / 1000);
    } catch {}
  };
  // Late arrivals: anything the events missed is held at the instant it is found. A CSS animation
  // still in its delay has fired no animationstart, so both readers sweep: the list read after
  // advanceTo(0) holds everything that exists then. One a script starts later is held by the seek
  // that first finds it.
  const collectLate = () => {
    const roots = openRoots();
    if (document.getAnimations) for (const anim of document.getAnimations()) hold(anim);
    for (const root of roots) {
      listen(root);
      if (root.getAnimations) for (const anim of root.getAnimations()) hold(anim);
    }
    for (const root of [document, ...roots]) {
      for (const svg of root.querySelectorAll("svg")) {
        if (svg.ownerSVGElement || svgSeen.has(svg) || !svg.querySelector(SMIL)) continue;
        svgSeen.add(svg);
        const s = { svg, startAt: clockNow() };
        svgs.push(s);
        placeSvg(s, s.startAt);
      }
    }
  };
  // Once paused through the API a CSS animation outlives its animation-name; the name is compared
  // escaped too, since computed style serialises slide:in as slide\\:in.
  const nameGone = (anim) => {
    if (typeof anim.animationName !== "string" || !anim.effect || !anim.effect.target) return false;
    try {
      const listed = getComputedStyle(anim.effect.target, anim.effect.pseudoElement || null)
        .animationName.split(",").map((n) => n.trim());
      const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(anim.animationName) : anim.animationName;
      return !listed.includes(anim.animationName) && !listed.includes(escaped);
    } catch { return false; }
  };
  // Every state is read before any animation is moved: playState and computed style each bring
  // style up to date, and read after a currentTime write they recomputed it once per animation:
  // 120 seeks of 150 dealt cards took 855ms that way and ~170ms read first (114ms before these
  // checks existed).
  window.__vlmkitSeekTimeline = (t) => {
    collectLate();
    const states = held.map((h) => {
      if (h.cancelled) return "cancelled";
      const state = h.anim.playState;
      return state !== "idle" && nameGone(h.anim) ? "gone" : state;
    });
    held.forEach((h, i) => {
      const state = states[i];
      if (state === "cancelled") return;
      // Never revive: setting currentTime on a cancelled (idle) animation brings it back. One the
      // page cancelled, or a CSS one whose element no longer lists its name, is cancelled for good
      // and stays in the list for the callers that attribute motion to it.
      if (state === "idle" || state === "gone") {
        if (state === "gone") { try { nativeCancel.call(h.anim); } catch {} }
        h.cancelled = true;
        return;
      }
      // Running again by a route play() does not see (animation-play-state, startTime): take it
      // over. Finished by the page (finish()): the page's.
      if (state === "running") takeOver(h);
      if (h.pagePaused || state === "finished") return;
      place(h, t);
    });
    for (const s of svgs) placeSvg(s, t);
  };
  // A SMIL clock value that is a plain number (seconds unless a unit says otherwise), else null.
  const clockValue = (text) => {
    const m = /^\\s*(\\d+(?:\\.\\d+)?|\\.\\d+)(ms|s|min|h)?\\s*$/.exec(text || "");
    return m ? Number(m[1]) * { ms: 1, s: 1000, min: 60000, h: 3600000 }[m[2] || "s"] : null;
  };
  // begin / dur / repeatCount / repeatDur read off the element; what is not a plain number
  // (an event or syncbase begin, an indefinite or absent dur) is listed as repeating from 0.
  const smilTiming = (el, startAt) => {
    const unknown = { startMs: 0, durationMs: 0, iterations: null };
    const begin = el.hasAttribute("begin") ? clockValue(el.getAttribute("begin")) : 0;
    const dur = clockValue(el.getAttribute("dur"));
    if (begin === null || dur === null) return unknown;
    let iterations = 1;
    const count = el.getAttribute("repeatCount");
    if (count !== null) {
      if (count.trim() === "indefinite") iterations = null;
      else if (Number(count) > 0) iterations = Number(count);
      else return unknown;
    }
    const repeatDur = el.getAttribute("repeatDur");
    if (repeatDur !== null && repeatDur.trim() !== "indefinite") {
      const span = clockValue(repeatDur);
      if (span === null || !(dur > 0)) return unknown;
      iterations = iterations === null ? span / dur : Math.min(iterations, span / dur);
    } else if (repeatDur !== null && count === null) iterations = null;
    return { startMs: startAt + begin, durationMs: dur, iterations };
  };
  window.__vlmkitTimelineAnimations = () => {
    collectLate();
    const out = held.map((h) => {
      let timing = {};
      try { timing = h.anim.effect && h.anim.effect.getComputedTiming ? h.anim.effect.getComputedTiming() : {}; } catch {}
      // Local times on the page's clock: at rate 2 a 1000ms animation takes 500ms of page time.
      const rate = h.anim.playbackRate > 0 ? h.anim.playbackRate : 1;
      return {
        startMs: h.startAt + (typeof timing.delay === "number" ? timing.delay : 0) / rate,
        durationMs: typeof timing.duration === "number" ? timing.duration / rate : 0,
        iterations: Number.isFinite(timing.iterations) ? timing.iterations : null,
      };
    });
    for (const s of svgs) for (const el of s.svg.querySelectorAll(SMIL)) out.push(smilTiming(el, s.startAt));
    return out;
  };
})()`;
