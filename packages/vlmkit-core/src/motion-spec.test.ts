import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import { tokenizeCommand } from "./arg-reader.ts";
import { parseGateConfig } from "./gate-config.ts";
import { motionSpecCommand, quoteArg } from "./motion-spec.ts";

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};
const compile = (spec: unknown) => motionSpecCommand(spec, "pages[0].gates[0].motion", fail);

describe("motionSpecCommand: a brief's expectations per target, as the flags inspect motion takes", () => {
  it("writes one flag per target where the flag repeats, one list where it is comma-separated, any for the rest", () => {
    const cmd = compile({
      actions: [{ click: ".delete" }],
      targets: [
        { selector: ".dialog", easing: "ease-out", duration: 250, direction: "up" },
        { selector: ".backdrop", easing: "linear", duration: 200 },
        { selector: ".delete", still: true },
      ],
    });
    assert.equal(
      cmd,
      "inspect motion --click .delete --selector .dialog --selector .backdrop --selector .delete" +
        " --expect-easing ease-out --expect-easing linear --expect-easing any" +
        " --expect-duration 250,200,any --expect-direction up,any,any --still .delete",
    );
  });

  it("puts selector targets before track ones, as the command line measures them, with names for all", () => {
    const cmd = compile({
      targets: [{ track: [800, 360, 80, 80], name: "square", direction: "right" }, { selector: ".label" }],
      start: 200,
      end: 800,
      baseline: ".vlmkit/motion/slide.json",
    });
    assert.equal(
      cmd,
      "inspect motion --selector .label --track 800,360,80,80 --target .label --target square" +
        " --expect-direction any,right --start 200 --end 800 --baseline .vlmkit/motion/slide.json",
    );
  });

  it("takes per-segment easings, a pivot point, actions of every kind and the run's own flags", () => {
    const cmd = compile({
      actions: [
        { hover: ".card" },
        { wait: 100 },
        { leave: true },
        { scroll: 400 },
        { click: "button[aria-label='Close menu']" },
      ],
      targets: [
        { selector: ".needle", easing: ["ease-out", "any"], origin: [160, 170], iterations: "infinite", lines: 1 },
      ],
      exits: true,
      reducedMotion: true,
      upright: true,
      stagger: "80ms",
    });
    assert.deepEqual(tokenizeCommand(cmd), [
      "inspect",
      "motion",
      "--hover",
      ".card",
      "--wait",
      "100",
      "--leave",
      "--scroll",
      "400",
      "--click",
      "button[aria-label='Close menu']",
      "--selector",
      ".needle",
      "--expect-easing",
      "ease-out,any",
      "--expect-origin",
      "160,170",
      "--expect-iterations",
      "infinite",
      "--expect-lines",
      "1",
      "--expect-stagger",
      "80ms",
      "--exits",
      "--reduced-motion",
      "--expect-upright",
    ]);
  });

  it("names the JSON path of every mistake", () => {
    const cases: [unknown, RegExp][] = [
      [{ targets: [] }, /targets: must be a non-empty array/],
      [{ targets: [{ selector: ".a", easeing: "ease" }] }, /targets\[0\]\.easeing: is not a target expectation/],
      [{ targets: [{ selector: ".a" }], exit: true }, /motion\.exit: is not a motion expectation/],
      [{ targets: [{ selector: ".a", track: "0,0,10,10" }] }, /targets\[0\]: needs exactly one of selector or track/],
      [{ targets: [{ track: "0,0,10,10", still: true }] }, /still and exit name an element/],
      [{ targets: [{ selector: ".a", iterations: 0 }] }, /iterations: must be a whole number of runs/],
      [{ targets: [{ selector: ".a" }], actions: [{ tap: ".a" }] }, /actions\[0\]\.tap: is not an action/],
      [{ targets: [{ selector: ".a" }], actions: [{ leave: false }] }, /actions\[0\]\.leave: must be true/],
    ];
    for (const [spec, message] of cases) assert.throws(() => compile(spec), message);
  });

  it("quotes what a space or a quote would split", () => {
    assert.equal(quoteArg(".a"), ".a");
    assert.equal(quoteArg("nav .tab"), "'nav .tab'");
    assert.equal(quoteArg("a[title='x y']"), "\"a[title='x y']\"");
    assert.deepEqual(tokenizeCommand(`x ${quoteArg("a[title='x y']")}`), ["x", "a[title='x y']"]);
  });
});

describe("vlmkit.gates.json: a gate entry may be { motion: ... }", () => {
  it("is compiled into the page's gate list, beside plain command strings", () => {
    const config = parseGateConfig(
      JSON.stringify({
        pages: [
          {
            source: "menu.html",
            gates: [
              "check integrity",
              { motion: { actions: [{ click: ".toggle" }], targets: [{ selector: ".menu", origin: "top" }] } },
            ],
          },
        ],
      }),
    );
    assert.deepEqual(config.pages[0]!.gates, [
      "check integrity",
      "inspect motion --click .toggle --selector .menu --expect-origin top",
    ]);
  });

  it("refuses an entry with other keys beside motion, and a mistake inside it, by path", () => {
    const page = (gate: unknown) => JSON.stringify({ pages: [{ source: "p.html", gates: [gate] }] });
    assert.throws(
      () => parseGateConfig(page({ motion: { targets: [{ selector: ".a" }] }, note: "x" })),
      /pages\[0\]\.gates\[0\]: a \{ "motion"/,
    );
    assert.throws(
      () => parseGateConfig(page({ motion: { targets: [{ selector: ".a", origin: 3 }] } })),
      /pages\[0\]\.gates\[0\]\.motion\.targets\[0\]\.origin/,
    );
  });
});
