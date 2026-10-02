import assert from "node:assert/strict";
import { describe, it } from "vite-plus/test";
import {
  oracleReply,
  pairedFlips,
  parseAnswer,
  parseHex,
  parseShift,
  scoreAnswer,
  signTestP,
  summarize,
  type BenchCase,
  type CaseScore,
} from "./score.ts";

const page = { width: 1000, height: 2000 };
const base = { fixture: "page.html", page, deviceScaleFactor: 2 };
const textCase: BenchCase = {
  ...base,
  id: "t",
  expected: { kind: "text", oldText: "2 days ago", newText: "7 days ago", oldToken: "2", newToken: "7" },
  diffBox: { x1: 900, y1: 400, x2: 910, y2: 412 },
};
const colorCase: BenchCase = {
  ...base,
  id: "c",
  expected: { kind: "color", oldColor: "#6b7280", newColor: "#ea580c" },
  diffBox: { x1: 10, y1: 10, x2: 80, y2: 24 },
};
const offsetCase: BenchCase = {
  ...base,
  id: "o",
  expected: { kind: "offset", dx: -4, dy: 0 },
  diffBox: { x1: 100, y1: 100, x2: 200, y2: 130 },
};
const noneCase: BenchCase = { ...base, id: "n", expected: { kind: "none" }, diffBox: null };

describe("parseAnswer", () => {
  it("finds the object inside a code fence and prose", () => {
    assert.deepEqual(parseAnswer('Sure.\n```json\n{"changed": true, "kind": "text", "new": "7 days ago"}\n```'), {
      changed: true,
      kind: "text",
      new: "7 days ago",
    });
  });
  it("skips a brace that does not open valid JSON and keeps braces inside strings", () => {
    assert.deepEqual(parseAnswer('see {this} then {"changed": false, "old": "a}b"}'), { changed: false, old: "a}b" });
  });
  it("reads a string boolean and a numeric-string box, drops a malformed box", () => {
    assert.deepEqual(parseAnswer('{"changed":"true","box":["1","2","3","4"]}'), { changed: true, box: [1, 2, 3, 4] });
    assert.deepEqual(parseAnswer('{"changed":true,"box":[1,2]}'), { changed: true });
  });
  it("returns null when there is no object", () => {
    assert.equal(parseAnswer("The label changed from 2 to 7."), null);
  });
});

describe("value parsers", () => {
  it("parseHex takes #rgb and #rrggbb, with or without #", () => {
    assert.deepEqual(parseHex("#ea580c"), [0xea, 0x58, 0x0c]);
    assert.deepEqual(parseHex("f00"), [255, 0, 0]);
    assert.equal(parseHex("orange"), null);
  });
  it("parseShift reads dx,dy and single-number phrasings", () => {
    assert.deepEqual(parseShift("-4,0"), { dx: -4, dy: 0 });
    assert.deepEqual(parseShift("4px left"), { dx: -4, dy: 0 });
    assert.deepEqual(parseShift("3 px down"), { dx: 0, dy: 3 });
    assert.equal(parseShift("a little"), null);
  });
});

describe("scoreAnswer", () => {
  it("text: right when the changed token is read, whatever else is transcribed", () => {
    const s = scoreAnswer(
      textCase,
      '{"changed":true,"box":[895,198,915,208],"kind":"text","old":"2 days ago","new":"7 day ago"}',
    );
    assert.deepEqual([s.correct, s.located], [true, true]);
    assert.equal(scoreAnswer(textCase, '{"changed":true,"new":"1 days ago"}').correct, false);
  });
  it("text: reporting the OLD text as the new one is wrong", () => {
    assert.equal(scoreAnswer(textCase, '{"changed":true,"new":"2 days ago"}').correct, false);
  });
  it("color: within tolerance counts, a different hue does not", () => {
    assert.equal(scoreAnswer(colorCase, '{"changed":true,"new":"#f06020"}').correct, true);
    const wrong = scoreAnswer(colorCase, '{"changed":true,"new":"#2563eb"}');
    assert.equal(wrong.correct, false);
    assert.match(wrong.note!, /off by/);
  });
  it("offset: direction and exact magnitude both matter", () => {
    assert.equal(scoreAnswer(offsetCase, '{"changed":true,"kind":"position","new":"-4,0"}').correct, true);
    assert.equal(
      scoreAnswer(offsetCase, '{"changed":true,"kind":"position","new":"-3,0"}').correct,
      false,
      "off by one is wrong now",
    );
    assert.equal(scoreAnswer(offsetCase, '{"changed":true,"kind":"position","new":"4,0"}').correct, false);
  });
  it("location is scored separately from correctness", () => {
    const s = scoreAnswer(textCase, '{"changed":true,"box":[0,0,100,100],"new":"7 days ago"}');
    assert.deepEqual([s.correct, s.located], [true, false]);
  });
  it("none: silence is right, an invented change is a false alarm", () => {
    assert.equal(scoreAnswer(noneCase, '{"changed":false}').correct, true);
    const alarm = scoreAnswer(noneCase, '{"changed":true,"kind":"color","new":"#ff0000"}');
    assert.equal(alarm.correct, false);
    assert.match(alarm.note!, /none was planted/);
  });
  it("a missed change and a reply with no JSON are both wrong, for different reasons", () => {
    assert.equal(scoreAnswer(textCase, '{"changed":false}').note, "missed the change");
    assert.equal(scoreAnswer(textCase, "It says 7 days ago.").parsed, false);
  });
  it("the oracle reply scores every kind, located", () => {
    for (const c of [textCase, colorCase, offsetCase, noneCase]) {
      const s = scoreAnswer(c, oracleReply(c));
      assert.equal(s.correct, true, c.id);
      if (c.diffBox) assert.equal(s.located, true, c.id);
    }
  });
});

describe("aggregation", () => {
  const sc = (correct: boolean): CaseScore => ({
    parsed: true,
    detected: correct,
    located: null,
    value: null,
    correct,
  });
  it("summarize counts per kind", () => {
    const s = summarize([
      { case: textCase, score: sc(true) },
      { case: noneCase, score: sc(false) },
    ]);
    assert.equal(s.correct, 1);
    assert.deepEqual(s.byKind.text, { cases: 1, correct: 1 });
    assert.deepEqual(s.byKind.none, { cases: 1, correct: 0 });
  });
  it("pairedFlips separates fixed from broken", () => {
    const single = [false, false, true, true].map(sc),
      zoom = [true, false, false, true].map(sc);
    assert.deepEqual(pairedFlips(single, zoom), { fixed: 1, broke: 1, bothRight: 1, bothWrong: 1 });
  });
  it("signTestP is the exact two-sided binomial tail", () => {
    assert.equal(signTestP(0, 0), 1);
    assert.equal(signTestP(5, 0), 2 / 32);
    assert.equal(signTestP(3, 1), (2 * (1 + 4)) / 16);
    assert.equal(signTestP(2, 2), 1);
    assert.ok(signTestP(12, 1) < 0.01);
  });
});
