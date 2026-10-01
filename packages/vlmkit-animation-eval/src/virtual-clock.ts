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
 */
export const VIRTUAL_CLOCK_SCRIPT = `(() => {
  if (window.__vlmkitClock) return;
  const FRAME_MS = 1000 / 60;
  const nativePerfNow = performance.now.bind(performance);
  const NativeDate = Date;
  // Virtual 0 is document start; Date keeps the real wall-clock date at that instant.
  const epochAtZero = NativeDate.now() - nativePerfNow();
  let now = 0;
  let lastFrame = 0;
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

  const schedule = (callback, delay, args, interval) => {
    const id = ++seq;
    const ms = Math.max(0, Number(delay) || 0);
    timers.set(id, { due: now + ms, callback, args, interval: interval ? Math.max(1, ms) : 0 });
    return id;
  };
  window.setTimeout = (callback, delay, ...args) => schedule(callback, delay, args, false);
  window.setInterval = (callback, delay, ...args) => schedule(callback, delay, args, true);
  window.clearTimeout = (id) => { timers.delete(id); };
  window.clearInterval = (id) => { timers.delete(id); };

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
      const frameAt = lastFrame + FRAME_MS;
      const timerAt = timer ? timer[1].due : Infinity;
      const at = Math.min(frameAt, timerAt);
      if (at > target) break;
      now = Math.max(now, at);
      if (timer && timerAt <= frameAt) {
        const [id, entry] = timer;
        if (entry.interval) entry.due += entry.interval;
        else timers.delete(id);
        invoke(entry.callback, entry.args || []);
      } else {
        lastFrame = frameAt;
        const queue = rafQueue;
        rafQueue = [];
        for (const entry of queue) invoke(entry.callback, [now]);
      }
      await drain();
    }
    now = Math.max(now, target);
    const waits = [];
    window.dispatchEvent(new CustomEvent("vlmkit:seek", {
      detail: { timeMs: now, waitUntil: (promise) => { waits.push(promise); } },
    }));
    await Promise.all(waits.map((p) => Promise.resolve(p).catch(() => undefined)));
    await drain();
    return now;
  }

  window.__vlmkitClock = {
    now: () => now,
    advanceTo,
    errors,
    pending: () => ({ timers: timers.size, frames: rafQueue.length }),
  };
})()`;
