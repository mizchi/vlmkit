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
 * a navigation (`openHeldTimeline`). `rendered()` waits, at most 250ms of real time, for the
 * browser's next rendering, where the finish events of animations a seek ended are dispatched.
 */
export const VIRTUAL_CLOCK_SCRIPT = `(() => {
  if (window.__vlmkitClock) return;
  const nativePerfNow = performance.now.bind(performance);
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
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
  // How many animation-frame callbacks and timer runs the clock has made: a value a timer updates
  // once a second (a live price) is not motion, and read "script-driven motion" under reduce.
  const runs = { frames: 0, timers: 0 };
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
        runs.timers += 1;
        invoke(entry.callback, entry.args || []);
        // Microtasks the callback queued are part of its task, so what they schedule nests too.
        await drain();
        level = 0;
      } else {
        frames += 1;
        const queue = rafQueue;
        rafQueue = [];
        if (queue.length > 0) runs.frames += 1;
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
    runs: () => ({ ...runs }),
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
    // Once the browser has next rendered, on the real clock: true, or false after maxMs. A Web
    // Animation's finish event is dispatched there, before the frame's rAF callbacks (Chromium
    // 141), and nothing else runs it: a page that does no rendering of its own got its onfinish
    // several instants after the seek that ended the animation. Bounded, as every wait on
    // rendering is: a page can starve rAF.
    rendered: (maxMs = 250) => new Promise((resolve) => {
      nativeFrame(() => resolve(true));
      nativeSetTimeout(() => resolve(false), maxMs);
    }),
  };
})()`;

/**
 * Every animation held from the instant it begins, with that instant recorded, so the whole
 * page can be put at one moment of its timeline: `window.__vlmkitSeekTimeline(t)` puts every
 * held animation at `anchor + (t - anchorAt) * playbackRate` (clamped to its effect), and
 * `__vlmkitTimelineAnimations()` lists what is held for picking instants. Used by
 * `check integrity --timeline`, `check flash` and the frames capture (`openHeldTimeline`) together
 * with `VIRTUAL_CLOCK_SCRIPT`, which holds the script half of the same moment.
 *
 * A seek that takes a held animation to its end (or, run backwards, to 0) ends it with the native
 * `finish()`, so its `finished` promise resolves and its `finish` event fires, as on a real clock:
 * a page that waits on one to start the next (`await intro.finished`, `onfinish`) is otherwise
 * never shown its next stage. What it starts there begins at that end on the page clock. A later
 * seek to before the end pauses it and puts it back.
 *
 * What a seek leaves alone: an animation at rate 0, one the page paused (until the page plays it —
 * then it is held again from where it was), one the page ended with `finish()` or that was found
 * finished after the clock had moved, and one that is cancelled (setting `currentTime` would
 * revive it). One found finished while the clock is still at 0 ran out in the real time load took
 * (a long task, a declarative shadow root whose start event nobody heard) and is held from 0.
 * The page's own writes (`currentTime`, `startTime`, `playbackRate`, `reverse()`,
 * `updatePlaybackRate()`) re-anchor a held animation at the page time they were made.
 * Animations inside open shadow roots are held too (`document.getAnimations()` leaves them out,
 * and their start events are not composed), and SMIL — which runs on each outermost `<svg>`'s own
 * timeline — is paused and put at the same page time with `setCurrentTime`.
 *
 * The page time an animation begins at is read off the virtual clock when one is installed (the
 * page time a script that started the animation saw), else `performance.now()`. CSS animations and
 * transitions run on `document.timeline`, which is real time: one that starts at load is caught at
 * `transitionrun` / `animationstart` with the page clock still at 0, and its own `currentTime`
 * already counts its delay, so `t - 0` is right. One a script starts later is caught when the
 * browser next renders, which can be after the virtual clock has moved on — its start is then late
 * by up to the advance that started it. That bound is the honest limit of seeking CSS by page time.
 */
export const HOLD_TIMELINE_SCRIPT = `(() => {
  if (window.__vlmkitTimeline) return;
  // { anim, anchor, anchorAt, startAt, pagePaused, cancelled, endedByHold, endedAt }: at page time
  // t a held animation is at anchor + (t - anchorAt) * playbackRate of its local time, clamped to
  // [0, its effect's end]. startAt, for the callers that attribute motion, is the page time its
  // local time was 0 at when it runs forwards (anchorAt - anchor / rate), and the page time it
  // began running backwards from its anchor when it does not. endedByHold: a seek ended it
  // (finish()), at page time endedAt, so its finished state is the hold's, not the page's.
  const held = [];
  window.__vlmkitTimeline = held;
  const entries = new WeakMap();
  const clockNow = () => (window.__vlmkitClock ? window.__vlmkitClock.now() : performance.now());
  const proto = Animation.prototype;
  const nativePause = proto.pause;
  const nativePlay = proto.play;
  const nativeCancel = proto.cancel;
  const nativeFinish = proto.finish;
  const nativeReverse = proto.reverse;
  const nativeUpdateRate = proto.updatePlaybackRate;
  const nativeListen = EventTarget.prototype.addEventListener;
  const accessor = (name) => Object.getOwnPropertyDescriptor(proto, name);
  const currentTimeAccessor = accessor("currentTime");
  const rateAccessor = accessor("playbackRate");
  const startTimeAccessor = accessor("startTime");
  const setCurrent = (anim, ms) => currentTimeAccessor.set.call(anim, ms);
  // Only what runs on the document timeline has a time to seek to: a scroll-driven animation's
  // times are percentages, and pausing one froze a reading-progress bar for good.
  const timeBased = (anim) =>
    typeof DocumentTimeline !== "undefined" && anim.timeline instanceof DocumentTimeline;
  // The local time its effect ends at (Infinity when it repeats forever; 0 with no effect).
  const endOf = (anim) => {
    try {
      const end = anim.effect ? anim.effect.getComputedTiming().endTime : 0;
      return typeof end === "number" ? end : Infinity;
    } catch { return Infinity; }
  };
  const local = (h, t) => h.anchor + (t - h.anchorAt) * h.anim.playbackRate;
  // Run to its end at page time t: past its effect's end forwards, or back to 0 backwards. One that
  // repeats forever only ends backwards (finish() refuses it forwards).
  const reached = (h, t, end) => {
    const rate = h.anim.playbackRate;
    if (rate > 0) return Number.isFinite(end) && local(h, t) >= end;
    return rate < 0 && local(h, t) <= 0;
  };
  // Where the page clock puts a held animation, ending nothing. A rate of 0 is the page's: it stays.
  const place = (h, t, end = endOf(h.anim)) => {
    if (h.anim.playbackRate === 0) return;
    try { setCurrent(h.anim, Math.min(Math.max(local(h, t), 0), end)); } catch {}
  };
  // While a held animation's end is delivered to the page — its finished promise's reactions, its
  // finish event — what the page starts begins at that end on the page clock, not at the later
  // instant the seek had reached (a coarse sweep started a second stage up to a whole step late).
  // { at, clock }: good while the clock still reads clock, and swept in the task after, since
  // the finish event is dispatched when the browser next renders, after the seek has returned.
  let origin = null;
  const sweep = new MessageChannel();
  sweep.port1.onmessage = () => { origin = null; };
  const startNow = () => {
    const now = clockNow();
    return origin !== null && origin.clock === now ? origin.at : now;
  };
  const adopt = (h) => {
    if (!h.endedByHold || h.endedAt === null) return;
    origin = { at: h.endedAt, clock: clockNow() };
    sweep.port2.postMessage(0);
  };
  // Our reaction on the finished promise the page will wait on, registered before the page can
  // register its own (the animate wrapper runs first), so it runs first when the promise resolves.
  // Each time the animation leaves its finished state the promise is a new one.
  const watch = (h) => {
    try {
      const promise = h.anim.finished;
      if (promise === h.watched) return;
      h.watched = promise;
      promise.then(() => adopt(h), () => {});
    } catch {}
  };
  // Paused where it is, with any pending playback rate applied: reverse() and updatePlaybackRate()
  // leave the new rate pending until the next frame (Chromium 141: playbackRate still read 1 after
  // reverse()), and writing currentTime completes the pause, and applies it, at once.
  const pauseHere = (anim) => {
    try { nativePause.call(anim); } catch {}
    const current = anim.currentTime;
    if (typeof current !== "number") return 0;
    try { setCurrent(anim, current); } catch {}
    return current;
  };
  // Animations the page ended itself with finish(): the page's, at any page time.
  const pageFinished = new WeakSet();
  // Held again from where it is now, at the page time it is now: after the page let it run, or
  // moved it. Every rate but 0 is taken over; one at rate 0 does not move, and is left running.
  const takeOver = (h) => {
    if (h.anim.playbackRate !== 0) h.anchor = pauseHere(h.anim);
    else h.anchor = typeof h.anim.currentTime === "number" ? h.anim.currentTime : 0;
    h.anchorAt = clockNow();
    h.pagePaused = false;
    h.cancelled = false;
    h.endedByHold = false;
    pageFinished.delete(h.anim);
    watch(h);
  };
  // anchored: its currentTime is the page's choice (new Animation() played, synchronously);
  // otherwise it was found by an event or a sweep, after real time ran, and it begins where found.
  const hold = (anim, anchored = false) => {
    if (!anim || entries.has(anim) || !timeBased(anim)) return;
    const state = anim.playState;
    const at = startNow();
    const h = {
      anim,
      anchor: 0,
      anchorAt: at,
      get startAt() {
        const rate = this.anim.playbackRate;
        return rate > 0 ? this.anchorAt - this.anchor / rate : this.anchorAt;
      },
      // One the page has already paused (a scrubber, animation-play-state: paused) is the page's.
      pagePaused: state === "paused",
      cancelled: false,
      endedByHold: false,
      endedAt: null,
      watched: null,
    };
    entries.set(anim, h);
    held.push(h);
    watch(h);
    try { nativeListen.call(anim, "finish", () => adopt(h)); } catch {}
    // Found finished while the clock is still at 0: it ran out in the real time load took, and is
    // held from 0 like a running one. Found finished later, it is the page's.
    const restart = state === "finished" && clockNow() === 0 && !pageFinished.has(anim);
    if ((state !== "running" && !restart) || anim.playbackRate === 0) return;
    const current = pauseHere(anim);
    if (anchored) h.anchor = current;
    else if (anim.playbackRate < 0) {
      // Run backwards it starts from its end, where play() would rewind it to.
      const end = endOf(anim);
      h.anchor = Number.isFinite(end) ? end : current;
    }
    // Put at its page time now when that is not where it was found: one that ran out at load, and
    // one started at a held animation's end that the clock has already passed.
    if (restart || at !== clockNow()) place(h, clockNow());
  };
  // A held animation whose time the hold keeps: not paused or finished by the page, not cancelled
  // or idle. Placing one the page finished would undo its finish().
  const live = (h) => {
    if (!h || h.pagePaused || h.cancelled) return false;
    const state = h.anim.playState;
    return state !== "idle" && (state !== "finished" || h.endedByHold);
  };
  // The page's own pause and play are seen: a held animation the page pauses is placed at the
  // page's present first (its currentTime is only as fresh as the last seek), then left to the
  // page; one it plays is taken over again from where that leaves it. An animation built with
  // new Animation() is held when the page first plays it.
  proto.pause = function () {
    const h = entries.get(this);
    if (h && !h.pagePaused && !h.cancelled && this.playState !== "idle") {
      if (live(h)) place(h, clockNow());
      h.pagePaused = true;
      h.endedByHold = false;
    }
    return nativePause.call(this);
  };
  proto.play = function () {
    const h = entries.get(this);
    if (live(h)) place(h, clockNow());
    const result = nativePlay.call(this);
    if (h) takeOver(h);
    else hold(this, true);
    return result;
  };
  proto.finish = function () {
    pageFinished.add(this);
    const h = entries.get(this);
    if (h) h.endedByHold = false;
    return nativeFinish.call(this);
  };
  // The page's own writes are seen too: one that moves a held animation holds it again from where
  // the write leaves it, at the page time the page made it. Without this a strobe the page set to
  // its end and reversed (currentTime = 2000; playbackRate = -1) sat where the hold had it. One the
  // page had finished and now sets running again (currentTime = 0) is taken over at once, not left
  // to run on the real clock until the next seek.
  const moved = (anim, change) => {
    const h = entries.get(anim);
    const wasLive = live(h);
    if (wasLive) place(h, clockNow());
    const result = change();
    if (wasLive || (h && !h.pagePaused && !h.cancelled && anim.playState === "running")) takeOver(h);
    return result;
  };
  for (const [name, desc] of [["currentTime", currentTimeAccessor], ["playbackRate", rateAccessor], ["startTime", startTimeAccessor]]) {
    if (!desc || !desc.set) continue;
    Object.defineProperty(proto, name, {
      ...desc,
      set(value) { moved(this, () => desc.set.call(this, value)); },
    });
  }
  proto.reverse = function () {
    return moved(this, () => nativeReverse.call(this));
  };
  // On a held animation the new rate is set at once: it is paused, where updatePlaybackRate() and
  // a playbackRate write do the same, except that updatePlaybackRate() leaves it pending a frame.
  proto.updatePlaybackRate = function (rate) {
    if (!live(entries.get(this))) return nativeUpdateRate.call(this, rate);
    return moved(this, () => { rateAccessor.set.call(this, rate); });
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
  // checks existed). Each effect's end is read with them; with that, and each card's finish() at
  // its end, 120 seeks of another 150-card CSS deal measured ~130ms before and ~180ms after.
  //
  // Returns how many animations it ended: their finish events are dispatched when the browser next
  // renders (the clock's rendered()), and what those start can itself end before t.
  window.__vlmkitSeekTimeline = (t) => {
    collectLate();
    const zero = clockNow() === 0;
    let ended = 0;
    const states = held.map((h) => {
      if (h.cancelled) return { state: "cancelled", end: 0 };
      const state = h.anim.playState;
      if (state !== "idle" && nameGone(h.anim)) return { state: "gone", end: 0 };
      return { state, end: state === "idle" ? 0 : endOf(h.anim) };
    });
    held.forEach((h, i) => {
      const { state, end } = states[i];
      if (state === "cancelled") return;
      // Never revive: setting currentTime on a cancelled (idle) animation brings it back. One the
      // page cancelled, or a CSS one whose element no longer lists its name, is cancelled for good
      // and stays in the list for the callers that attribute motion to it.
      if (state === "idle" || state === "gone") {
        if (state === "gone") { try { nativeCancel.call(h.anim); } catch {} }
        h.cancelled = true;
        return;
      }
      if (state === "running") {
        // Running again by a route no wrapper sees (animation-play-state, a changed effect): take
        // it over.
        takeOver(h);
      } else if (state === "finished") {
        if (h.endedByHold) {
          // Ended by an earlier seek: it stays ended while the page time is past its end, and a
          // seek back before it (check flash attributes a window at its middle) pauses it and puts
          // it back, instead of letting it run on the real clock.
          if (reached(h, t, end)) return;
          try { nativePause.call(h.anim); } catch {}
          h.endedByHold = false;
          watch(h);
          place(h, t, end);
          return;
        }
        // Ended by the page (finish()), or found finished after the clock moved: the page's.
        // Finished while the clock is still at 0, it ran out during load: held from 0.
        if (h.pagePaused || !zero || pageFinished.has(h.anim)) return;
        h.anchor = h.anim.playbackRate < 0 && Number.isFinite(end) ? end : 0;
        h.anchorAt = 0;
        try { nativePause.call(h.anim); } catch {}
        watch(h);
      }
      if (h.pagePaused || h.anim.playbackRate === 0) return;
      if (!reached(h, t, end)) {
        place(h, t, end);
        return;
      }
      // At or past its end: ended natively, so finished resolves and onfinish / finish listeners
      // run; what they start begins at this end (adopt). A CSS animation's animationend is the
      // phase change, which finish() makes once, as a seek past the end did before.
      const rate = h.anim.playbackRate;
      h.endedAt = Math.max(h.anchorAt, h.anchorAt + ((rate > 0 ? end : 0) - h.anchor) / rate);
      h.endedByHold = true;
      watch(h);
      try {
        nativeFinish.call(h.anim);
        ended += 1;
      } catch {
        h.endedByHold = false;
        place(h, t, end);
      }
    });
    for (const s of svgs) placeSvg(s, t);
    return ended;
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
      const delay = typeof timing.delay === "number" ? timing.delay : 0;
      const duration = typeof timing.duration === "number" ? timing.duration : 0;
      const iterations = Number.isFinite(timing.iterations) ? timing.iterations : null;
      const rate = h.anim.playbackRate;
      if (!(rate < 0)) {
        // Local times on the page's clock: at rate 2 a 1000ms animation takes 500ms of page time.
        const speed = rate > 0 ? rate : 1;
        return { startMs: h.startAt + delay / speed, durationMs: duration / speed, iterations };
      }
      // Run backwards from its anchor, it plays its active phase from there down to its delay:
      // it enters it once its local time falls below the active phase's end.
      const speed = -rate;
      const activeEnd = delay + (typeof timing.activeDuration === "number" ? timing.activeDuration : 0);
      return {
        startMs: h.anchorAt + Math.max(0, h.anchor - activeEnd) / speed,
        durationMs: duration / speed,
        iterations: duration > 0 ? Math.max(0, Math.min(h.anchor, activeEnd) - delay) / duration : 0,
      };
    });
    for (const s of svgs) for (const el of s.svg.querySelectorAll(SMIL)) out.push(smilTiming(el, s.startAt));
    return out;
  };
})()`;
