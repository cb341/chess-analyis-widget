const assert = require("node:assert/strict");
const fs = require("node:fs");

const registry = {};

function createNode(tagName) {
  return {
    tagName,
    children: [],
    attributes: {},
    textContent: "",
    className: "",
    style: {
      setProperty(name, value) {
        this[name] = value;
      },
    },
    classList: {
      values: [],
      add(name) {
        this.values.push(name);
      },
      remove(name) {
        this.values = this.values.filter((value) => value !== name);
      },
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    addEventListener(name, callback) {
      this.listeners ||= {};
      this.listeners[name] ||= [];
      this.listeners[name].push(callback);
    },
  };
}

global.document = {
  baseURI: "https://example.test/pages/demo.html",
  currentScript: { src: "file:///tmp/chess-widget.js" },
  createElement: createNode,
  listeners: {},
  addEventListener(name, callback) {
    this.listeners[name] ||= [];
    this.listeners[name].push(callback);
  },
  removeEventListener(name, callback) {
    this.listeners[name] = (this.listeners[name] || []).filter((listener) => listener !== callback);
  },
};

global.customElements = {
  define(name, klass) {
    registry[name] = klass;
  },
  get(name) {
    return registry[name];
  },
};

global.HTMLElement = class {
  constructor() {
    this.attrs = {};
    this.children = [];
    this.textContent = "";
    this.classList = {
      values: [],
      add(name) {
        this.values.push(name);
      },
      remove(name) {
        this.values = this.values.filter((value) => value !== name);
      },
    };
    this.listeners = {};
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }

  getAttribute(name) {
    return this.attrs[name] || null;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(name, callback) {
    this.listeners[name] ||= [];
    this.listeners[name].push(callback);
  }

  dispatchEvent(event) {
    (this.listeners[event.type] || []).forEach((callback) => callback(event));
    return !event.defaultPrevented;
  }
};

global.CustomEvent = class {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail || null;
    this.bubbles = !!options.bubbles;
    this.cancelable = !!options.cancelable;
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
};

global.window = {};
global.window.setTimeout = setTimeout;
global.window.clearTimeout = clearTimeout;

eval(fs.readFileSync("chess-pgn.js", "utf8"));
eval(fs.readFileSync("chess-widget.js", "utf8"));

const ChessWidget = registry["chess-widget"];

async function loadPgn(pgn, attrs = {}) {
  const widget = new ChessWidget();
  widget.textContent = pgn;
  Object.entries(attrs).forEach(([name, value]) => widget.setAttribute(name, value));
  widget.render = function () {};
  widget.renderError = function (message) {
    throw new Error(message);
  };
  widget.connectedCallback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  return widget;
}

async function testSamplePgn() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  assert.equal(widget.game.metadata.White, "Magnus Carlsen");
  assert.equal(widget.game.metadata.Black, "Garry Kasparov");
  assert.equal(widget.game.metadata.WhiteElo, "2484");
  assert.equal(widget.game.metadata.BlackElo, "2831");
  assert.equal(widget.game.moves.length, 103);
  assert.equal(widget.game.positions.length, 104);
  assert.equal(widget.game.moves[0].san, "d4");
  assert.deepEqual(widget.game.moves[0].eval, { value: 0.15, mate: false });
  assert.equal(widget.game.moves[0].clock, null);
  assert.deepEqual(widget.game.moves[40].eval, { value: 2.09, mate: false });
}

async function testCommentAttachmentAndGlyphs() {
  const pgn = `
[White "Commenter"]
[Black "Tester"]
[WhiteElo "2100"]
[BlackElo "2050"]

1. e4! { [%eval 0.31] [%clk 0:03:00] Attached to e4. } e5 $2 { Attached to e5. } 2. Nf3?! { [%eval #-3] Mate warning. } Nc6
`;
  const widget = await loadPgn(pgn);
  assert.equal(widget.game.moves[0].san, "e4");
  assert.equal(widget.game.moves[0].glyph, "!");
  assert.equal(widget.game.moves[0].comment, "Attached to e4.");
  assert.equal(widget.game.moves[1].glyph, "?");
  assert.equal(widget.game.moves[1].comment, "Attached to e5.");
  assert.equal(widget.game.moves[2].glyph, "?!");
  assert.deepEqual(widget.game.moves[2].eval, { value: -3, mate: true });
  assert.equal(widget.game.moves[2].comment, "Mate warning.");
}

async function testFenStartAndBounds() {
  const pgn = `
[SetUp "1"]
[FEN "8/8/8/8/8/8/4P3/4K2k w - - 0 1"]
[White "Fen"]
[Black "Start"]

1. e4 { [%eval 1.00] }
`;
  const widget = await loadPgn(pgn, { start: "1", end: "1" });
  assert.equal(widget.game.positions[0].fen, "8/8/8/8/8/8/4P3/4K2k w -  - 0 1".replace(" -  - ", " - - "));
  assert.equal(widget.currentPly, 1);
  widget.previous();
  assert.equal(widget.currentPly, 1);
  widget.next();
  assert.equal(widget.currentPly, 1);
}

async function testPromotionAndEnPassant() {
  const promotion = await loadPgn(`
[SetUp "1"]
[FEN "7k/4P3/8/8/8/8/8/4K3 w - - 0 1"]

1. e8=Q
`);
  assert.equal(promotion.game.positions[1].board.e8, "Q");

  const enPassant = await loadPgn(`
[SetUp "1"]
[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"]

1. exd6
`);
  assert.equal(enPassant.game.positions[1].board.d6, "P");
  assert.equal(enPassant.game.positions[1].board.d5, undefined);
}

async function testSrcWinsOverFallback() {
  const pgn = fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8");
  global.fetch = async function (url) {
    assert.equal(url, "/assets/games/carlsen-kasparov-reykjavik-rapid.pgn");
    return {
      ok: true,
      async text() {
        return pgn;
      },
    };
  };
  const widget = await loadPgn("See the annotated game on the site", {
    src: "/assets/games/carlsen-kasparov-reykjavik-rapid.pgn",
  });
  assert.equal(widget.game.metadata.White, "Magnus Carlsen");
  assert.equal(widget.game.moves[0].san, "d4");
  delete global.fetch;
}

async function testInlinePgnFromNestedElement() {
  const widget = new ChessWidget();
  widget.textContent = "Enable JavaScript to show widget";
  widget.querySelector = function (selector) {
    assert.equal(selector, 'script[type="application/x-chess-pgn"], script[type="text/pgn"], template[data-pgn]');
    return {
      textContent: `
[White "Inline"]
[Black "Nested"]

1. d4 d5
`,
    };
  };
  widget.render = function () {};
  widget.renderError = function (message) {
    throw new Error(message);
  };
  widget.connectedCallback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(widget.game.metadata.White, "Inline");
  assert.equal(widget.game.moves[0].san, "d4");
}

async function testMoveListGroupsByMoveNumber() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    start: "2",
    end: "5",
  });
  const list = widget.renderMoveList(widget.game).children[0];
  assert.equal(list.children.length, 3);
  assert.equal(list.children[0].children[0].textContent, "1.");
  assert.equal(list.children[0].children[1].tagName, "span");
  assert.equal(list.children[0].children[2].children[0].textContent, "d5");
  assert.equal(list.children[1].children[0].textContent, "2.");
  assert.equal(list.children[1].children[1].children[0].textContent, "c4");
  assert.equal(list.children[1].children[2].children[0].textContent, "c6");
  assert.equal(list.children[2].children[0].textContent, "3.");
  assert.equal(list.children[2].children[1].children[0].textContent, "Nf3");
  assert.equal(list.children[2].children[2].tagName, "span");
}

async function testMinimalModeIsControlsOnly() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    minimal: "",
  });
  const boardPanel = widget.renderBoard;
  let rendered = null;
  widget.render = ChessWidget.prototype.render.bind(widget);
  widget.appendChild = function (node) {
    rendered = node;
  };
  widget.innerHTML = "";
  widget.render();
  const main = rendered.children[0];
  const panel = main.children[0];
  assert.equal(main.className, "cw-main cw-main-minimal");
  assert.equal(panel.children.length, 2);
  assert.equal(panel.children[0].className, "cw-board-with-eval");
  assert.equal(panel.children[0].children.length, 1);
  assert.equal(panel.children[1].className, "cw-controls");
  assert.equal(boardPanel instanceof Function, true);
}

async function testBoardOnlyModeKeepsOnlyBoard() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    "board-only": "",
  });
  let rendered = null;
  widget.render = ChessWidget.prototype.render.bind(widget);
  widget.appendChild = function (node) {
    rendered = node;
  };
  widget.innerHTML = "";
  widget.render();
  const main = rendered.children[0];
  const panel = main.children[0];
  assert.equal(main.className, "cw-main cw-main-minimal");
  assert.equal(panel.children.length, 1);
  assert.equal(panel.children[0].className, "cw-board-with-eval");
  assert.equal(panel.children[0].children.length, 1);
}

async function testFalseFeatureAttributesHideFeatures() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    header: "false",
    controls: "false",
    comments: "false",
    moves: "false",
    "eval-bar": "false",
    "eval-chart": "false",
  });
  let rendered = null;
  widget.render = ChessWidget.prototype.render.bind(widget);
  widget.appendChild = function (node) {
    rendered = node;
  };
  widget.innerHTML = "";
  widget.render();
  assert.equal(rendered.children.length, 2);
  const main = rendered.children[0];
  const live = rendered.children[1];
  const panel = main.children[0];
  assert.equal(main.className, "cw-main");
  assert.equal(main.children.length, 1);
  assert.equal(panel.children.length, 1);
  assert.equal(panel.children[0].className, "cw-board-with-eval");
  assert.equal(panel.children[0].children.length, 1);
  assert.equal(live.className, "cw-live");
}

async function testMoveAnimationState() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  widget.previousPosition = widget.game.positions[0];
  widget.previousPly = 0;
  widget.currentPly = 1;
  widget.navigationDirection = "forward";
  const boardWrap = widget.renderBoard(widget.game.positions[1]);
  const board = boardWrap.children[0].children[0];
  const d4Pawn = board.children.find(function (node) {
    return node.tagName === "piece" && node.attributes["aria-label"] === "d4, White pawn";
  });
  assert.ok(d4Pawn);
  assert.ok(d4Pawn.className.includes("cw-piece-arrived"));
  assert.equal(d4Pawn.style["--cw-from-transform"], "translate(300%, 600%)");
  assert.equal(d4Pawn.style["--cw-transform"], "translate(300%, 400%)");
  assert.equal(d4Pawn.style.transform, "var(--cw-transform)");
}

async function testCaptureAnnotationClass() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  const capturePosition = widget.game.positions.find(function (position) {
    return position.flags && position.flags.capture;
  });
  assert.ok(capturePosition);
  const annotation = widget.renderAnnotation(capturePosition);
  assert.ok(annotation.className.includes("cw-annotation-capture"));
}

async function testGlyphAnnotationClasses() {
  const pgn = `
[White "Annotations"]
[Black "Tester"]

1. e4?? e5? 2. Nf3!! Nc6!? 3. Bb5?!
`;
  const widget = await loadPgn(pgn);
  assert.ok(widget.renderAnnotation(widget.game.positions[1]).className.includes("cw-annotation-blunder"));
  assert.ok(widget.renderAnnotation(widget.game.positions[2]).className.includes("cw-annotation-mistake"));
  assert.ok(widget.renderAnnotation(widget.game.positions[3]).className.includes("cw-annotation-brilliant"));
  assert.ok(widget.renderAnnotation(widget.game.positions[4]).className.includes("cw-annotation-good"));
  assert.ok(widget.renderAnnotation(widget.game.positions[5]).className.includes("cw-annotation-inaccuracy"));
}

async function testMoveBadgesForKeyGlyphs() {
  const pgn = `
[White "Badges"]
[Black "Tester"]

1. e4?? e5? 2. Nf3!!
`;
  const widget = await loadPgn(pgn, {
    "badge-blunder": "B",
    "badge-mistake": "M",
    "badge-brilliant": "*",
  });
  const blunderBadge = widget.renderMoveBadge(widget.game.positions[1]);
  assert.equal(blunderBadge.className, "cw-piece-badge cw-piece-badge-blunder");
  assert.equal(blunderBadge.children[0].textContent, "B");
  assert.equal(blunderBadge.attributes["data-badge"], "blunder");
  assert.equal(blunderBadge.attributes["aria-label"], "Blunder");
  assert.equal(blunderBadge.style["--cw-transform"], widget.squareTransform("e4"));

  const mistakeBadge = widget.renderMoveBadge(widget.game.positions[2]);
  assert.equal(mistakeBadge.className, "cw-piece-badge cw-piece-badge-mistake");
  assert.equal(mistakeBadge.children[0].textContent, "M");

  const brilliantBadge = widget.renderMoveBadge(widget.game.positions[3]);
  assert.equal(brilliantBadge.className, "cw-piece-badge cw-piece-badge-brilliant");
  assert.equal(brilliantBadge.children[0].textContent, "*");

  widget.setAttribute("move-badges", "false");
  assert.equal(widget.renderMoveBadge(widget.game.positions[1]), null);
}

async function testSeekAnimationMovesMatchedPieces() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  widget.currentPly = 0;
  widget.goTo(4);
  const boardWrap = widget.renderBoard(widget.game.positions[4]);
  const board = boardWrap.children[0].children[0];
  const d4Pawn = board.children.find(function (node) {
    return node.tagName === "piece" && node.attributes["aria-label"] === "d4, White pawn";
  });
  const c6Pawn = board.children.find(function (node) {
    return node.tagName === "piece" && node.attributes["aria-label"] === "c6, Black pawn";
  });
  assert.ok(d4Pawn);
  assert.ok(c6Pawn);
  assert.ok(d4Pawn.className.includes("cw-piece-arrived"));
  assert.ok(c6Pawn.className.includes("cw-piece-arrived"));
  assert.equal(d4Pawn.style["--cw-from-transform"], "translate(300%, 600%)");
  assert.equal(c6Pawn.style["--cw-from-transform"], "translate(200%, 100%)");
}

async function testKeyboardTitlesAreDiscoverable() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  assert.match(widget.attrs.title, /Arrow keys/);
  assert.equal(widget.attrs["aria-keyshortcuts"], "ArrowLeft ArrowRight ArrowUp ArrowDown Home End");
  const controls = widget.renderControls(widget.game);
  assert.match(controls.children[0].title, /ArrowLeft/);
  assert.match(controls.children[1].title, /Home and End/);
  assert.match(controls.children[2].title, /ArrowRight/);
  const moveButton = widget.renderMoveButton(widget.game.moves[3]);
  assert.match(moveButton.title, /Go to 2\.\.\. c6/);
  assert.match(moveButton.title, /arrow keys/);
}

async function testMoveListSkimmingPlaysSound() {
  const played = [];
  global.window.Audio = class {
    constructor(src) {
      this.src = String(src);
      played.push(this.src);
    }

    play() {
      return Promise.resolve();
    }

    pause() {}
  };

  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    sound: "",
  });
  const moveButton = widget.renderMoveButton(widget.game.moves[0]);
  moveButton.listeners.pointerenter[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 1);
  assert.ok(played[0].endsWith("/assets/sounds/standard/Move.mp3"));
  moveButton.listeners.pointerleave[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 0);

  const committedMove = widget.renderMoveButton(widget.game.moves[1]);
  committedMove.listeners.pointerenter[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 2);
  committedMove.listeners.click[0]({ preventDefault() {} });
  committedMove.listeners.pointerleave[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 2);

  const soundCount = played.length;
  const touchMove = widget.renderMoveButton(widget.game.moves[1]);
  touchMove.listeners.pointerenter[0]({ pointerType: "touch" });
  assert.equal(widget.currentPly, 2);
  assert.equal(played.length, soundCount);

  const originalMatchMedia = global.window.matchMedia;
  global.window.matchMedia = function (query) {
    assert.equal(query, "(hover: none), (pointer: coarse)");
    return { matches: true };
  };
  const coarseMove = widget.renderMoveButton(widget.game.moves[2]);
  coarseMove.listeners.pointerenter[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 2);
  assert.equal(played.length, soundCount);
  global.window.matchMedia = originalMatchMedia;

  widget._moveListScrolling = true;
  const scrollingHoverMove = widget.renderMoveButton(widget.game.moves[4]);
  scrollingHoverMove.listeners.pointerenter[0]({ pointerType: "mouse" });
  assert.equal(widget.currentPly, 2);
  widget._moveListScrolling = false;

  const scrollMove = widget.renderMoveButton(widget.game.moves[3]);
  scrollMove.listeners.touchstart[0]({
    touches: [{ clientX: 20, clientY: 20 }],
  });
  scrollMove.listeners.touchmove[0]({
    touches: [{ clientX: 22, clientY: 64 }],
  });
  scrollMove.listeners.touchend[0]({});
  let clickPrevented = false;
  scrollMove.listeners.click[0]({
    preventDefault() {
      clickPrevented = true;
    },
  });
  assert.equal(clickPrevented, true);
  assert.equal(widget.currentPly, 2);

  delete global.window.Audio;
}

async function testArrowControlLabels() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    "control-style": "arrows",
  });
  const controls = widget.renderControls(widget.game);
  assert.equal(controls.children[0].textContent, "<");
  assert.equal(controls.children[2].textContent, ">");
}

async function testControlTouchHandlers() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  const controls = widget.renderControls(widget.game);
  assert.equal(controls.children[0].attributes["data-control"], "previous");
  assert.equal(controls.children[2].attributes["data-control"], "next");
  assert.equal(controls.children[0].listeners.touchstart.length, 1);
  assert.equal(controls.children[0].listeners.touchend.length, 1);
  widget.currentPly = 0;
  let startPrevented = false;
  widget.prepareControlTouch({
    preventDefault() {
      startPrevented = true;
    },
  });
  assert.equal(startPrevented, true);
  assert.equal(widget._controlTouchStarted, true);

  let touchPrevented = false;
  widget.activateControl({
    type: "touchend",
    preventDefault() {
      touchPrevented = true;
    },
  }, "next");
  assert.equal(touchPrevented, true);
  assert.equal(widget.currentPly, 1);
  assert.equal(widget._suppressNextControlClick, true);

  let clickPrevented = false;
  widget.activateControl({
    type: "click",
    preventDefault() {
      clickPrevented = true;
    },
  }, "next");
  assert.equal(clickPrevented, true);
  assert.equal(widget.currentPly, 1);
}

async function testBoardSwipeNavigation() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    "board-only": "",
  });
  let capturedPointer = null;
  let releasedPointer = null;
  widget.setPointerCapture = function (pointerId) {
    capturedPointer = pointerId;
  };
  widget.releasePointerCapture = function (pointerId) {
    releasedPointer = pointerId;
  };
  const board = widget.renderBoard(widget.game.positions[0]);
  assert.equal(board.listeners.touchstart.length, 1);
  assert.equal(board.listeners.pointerdown.length, 1);

  widget.currentPly = 1;
  board.listeners.pointerdown[0]({
    pointerId: 7,
    pointerType: "touch",
    clientX: 180,
    clientY: 80,
  });
  assert.equal(capturedPointer, 7);
  let pointerMovePrevented = false;
  widget.listeners.pointermove[0]({
    pointerId: 7,
    clientX: 120,
    clientY: 84,
    preventDefault() {
      pointerMovePrevented = true;
    },
  });
  assert.equal(pointerMovePrevented, true);
  assert.equal(widget.currentPly, 3);
  widget.listeners.pointermove[0]({
    pointerId: 7,
    clientX: 60,
    clientY: 88,
    preventDefault() {},
  });
  assert.equal(widget.currentPly, 6);
  widget.listeners.pointerup[0]({
    pointerId: 7,
    clientX: 60,
    clientY: 88,
    preventDefault() {},
  });
  assert.equal(releasedPointer, 7);

  widget.currentPly = 1;
  board.listeners.touchstart[0]({
    touches: [{ clientX: 180, clientY: 80 }],
  });
  assert.equal(global.document.listeners.touchmove.length, 1);
  assert.equal(global.document.listeners.touchend.length, 1);
  let movePrevented = false;
  global.document.listeners.touchmove[0]({
    touches: [{ clientX: 120, clientY: 84 }],
    preventDefault() {
      movePrevented = true;
    },
  });
  assert.equal(movePrevented, true);
  assert.equal(widget.currentPly, 3);

  let endPrevented = false;
  global.document.listeners.touchend[0]({
    changedTouches: [{ clientX: 116, clientY: 84 }],
    preventDefault() {
      endPrevented = true;
    },
  });
  assert.equal(endPrevented, true);
  assert.equal(widget.currentPly, 3);
  assert.equal(global.document.listeners.touchmove.length, 0);

  board.listeners.touchstart[0]({
    touches: [{ clientX: 120, clientY: 80 }],
  });
  global.document.listeners.touchend[0]({
    changedTouches: [{ clientX: 174, clientY: 83 }],
    preventDefault() {},
  });
  assert.equal(widget.currentPly, 1);

  board.listeners.touchstart[0]({
    touches: [{ clientX: 120, clientY: 80 }],
  });
  global.document.listeners.touchend[0]({
    changedTouches: [{ clientX: 130, clientY: 150 }],
    preventDefault() {
      throw new Error("vertical drags should not navigate");
    },
  });
  assert.equal(widget.currentPly, 1);
}

async function testBoardControlOutlineDismissesOutsideBoard() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  const board = widget.renderBoard(widget.game.positions[0]);
  widget.focus = function () {};
  board.listeners.click[0]({});
  assert.ok(widget.classList.values.includes("cw-board-controlled"));

  widget.handleDocumentPointerDown({
    target: {
      closest() {
        return null;
      },
    },
  });
  assert.equal(widget.classList.values.includes("cw-board-controlled"), false);
}

async function testEvalChartScrubbing() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    "eval-chart": "",
  });
  const chart = widget.renderEvalChart(widget.game);
  const svg = chart.children[0];
  svg.getBoundingClientRect = function () {
    return { left: 10, width: 320 };
  };
  let pointerPrevented = false;
  svg.listeners.pointerdown[0]({
    pointerId: 4,
    buttons: 1,
    clientX: 170,
    preventDefault() {
      pointerPrevented = true;
    },
  });
  assert.equal(pointerPrevented, true);
  assert.equal(widget.currentPly, Math.round((160 / 320) * (widget.game.positions.length - 1)));

  svg.listeners.pointermove[0]({
    pointerId: 4,
    buttons: 1,
    clientX: 330,
    preventDefault() {},
  });
  assert.equal(widget.currentPly, widget.game.positions.length - 1);
}

async function testMoveSoundsUseAnnotationsAndOverrides() {
  const played = [];
  global.window.Audio = class {
    constructor(src) {
      this.src = String(src);
      played.push(["new", this.src]);
    }

    play() {
      played.push(["play", this.src]);
      return Promise.resolve();
    }

    pause() {
      played.push(["pause", this.src]);
    }
  };

  function lastSource() {
    const sources = played.filter(([kind]) => kind === "new").map(([, src]) => src);
    return sources[sources.length - 1];
  }

  const widget = await loadPgn(`
[White "Sounds"]
[Black "Tester"]

1. e4?? e5? 2. Nf3!! Nc6 3. Bb5! a6 4. Bxa6!! Nf6
`, {
    sound: "",
    "sound-brilliant": "./custom/brilliant.wav",
  });

  widget.goTo(1);
  assert.ok(lastSource().endsWith("/assets/sounds/standard/Error.mp3"));
  widget.goTo(2);
  assert.ok(lastSource().endsWith("/assets/sounds/standard/Error.mp3"));
  widget.goTo(3);
  assert.equal(lastSource(), "https://example.test/pages/custom/brilliant.wav");
  widget.goTo(5);
  assert.ok(lastSource().endsWith("/assets/sounds/standard/Select.mp3"));
  const soundCount = played.filter(([kind]) => kind === "new").length;
  widget.removeAttribute("sound");
  widget.goTo(6);
  assert.equal(played.filter(([kind]) => kind === "new").length, soundCount);
  assert.ok(lastSource().endsWith("/assets/sounds/standard/Select.mp3"));
  widget.setAttribute("sound", "");
  widget.goTo(7);
  assert.ok(lastSource().endsWith("/assets/sounds/standard/Capture.mp3"));

  delete global.window.Audio;
}

async function testAssetConfiguration() {
  const widget = await loadPgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"), {
    "piece-path": "./pieces/neo",
    "piece-white-king": "./pieces/custom-white-king.svg",
  });
  assert.equal(widget.renderPieceImage("K").src, "https://example.test/pages/pieces/custom-white-king.svg");
  assert.equal(widget.renderPieceImage("q").src, "https://example.test/pages/pieces/neo/black-queen.svg");

  ChessWidget.configureAssets({
    piecePath: "./configured-pieces",
    sounds: { move: "./configured-sounds/move.mp3" },
  });
  const configured = await loadPgn(`
[White "Assets"]
[Black "Tester"]

1. e4 e5
`, { sound: "" });
  assert.equal(configured.renderPieceImage("n").src, "https://example.test/pages/configured-pieces/black-knight.svg");
  configured.setAttribute("piece-path", "./changed-pieces");
  configured.attributeChangedCallback("piece-path", "./configured-pieces", "./changed-pieces");
  assert.equal(configured.renderPieceImage("n").src, "https://example.test/pages/changed-pieces/black-knight.svg");

  let renderCount = 0;
  configured.render = function () {
    renderCount += 1;
  };
  const originalQuerySelectorAll = global.document.querySelectorAll;
  global.document.querySelectorAll = function (selector) {
    assert.equal(selector, "chess-widget");
    return [configured];
  };
  ChessWidget.configureAssets({ pieces: { q: "./configured-pieces/black-queen.svg" } });
  assert.equal(renderCount, 1);
  global.document.querySelectorAll = originalQuerySelectorAll;

  const played = [];
  global.window.Audio = class {
    constructor(src) {
      this.src = String(src);
      played.push(this.src);
    }

    play() {
      return Promise.resolve();
    }

    pause() {}
  };
  configured.goTo(1);
  assert.equal(played[0], "https://example.test/pages/configured-sounds/move.mp3");
  delete global.window.Audio;
}

async function testCustomEventsAndParserExtensionPoint() {
  const parsed = ChessWidget.parsePgn(fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8"));
  assert.equal(parsed.metadata.White, "Magnus Carlsen");

  const widget = new ChessWidget();
  const seen = [];
  widget.textContent = fs.readFileSync("assets/games/carlsen-kasparov-reykjavik-rapid.pgn", "utf8");
  widget.addEventListener("chess-widget:load", function (event) {
    seen.push(["load", event.detail.game.metadata.White]);
  });
  widget.addEventListener("chess-widget:render", function (event) {
    seen.push(["render", event.detail.ply]);
  });
  widget.addEventListener("chess-widget:beforemove", function (event) {
    seen.push(["beforemove", event.detail.from, event.detail.to]);
    if (event.detail.to === 2) event.preventDefault();
  });
  widget.addEventListener("chess-widget:move", function (event) {
    seen.push(["move", event.detail.from, event.detail.to]);
  });
  widget.renderError = function (message) {
    throw new Error(message);
  };
  widget.connectedCallback();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(seen[0], ["load", "Magnus Carlsen"]);
  assert.deepEqual(seen[1], ["render", 0]);
  widget.goTo(2);
  assert.equal(widget.currentPly, 0);
  widget.goTo(1);
  assert.equal(widget.currentPly, 1);
  assert.deepEqual(seen.slice(-3), [
    ["beforemove", 0, 1],
    ["render", 1],
    ["move", 0, 1],
  ]);
}

async function run() {
  await testSamplePgn();
  await testCommentAttachmentAndGlyphs();
  await testFenStartAndBounds();
  await testPromotionAndEnPassant();
  await testSrcWinsOverFallback();
  await testInlinePgnFromNestedElement();
  await testMoveListGroupsByMoveNumber();
  await testMinimalModeIsControlsOnly();
  await testBoardOnlyModeKeepsOnlyBoard();
  await testFalseFeatureAttributesHideFeatures();
  await testMoveAnimationState();
  await testCaptureAnnotationClass();
  await testGlyphAnnotationClasses();
  await testMoveBadgesForKeyGlyphs();
  await testSeekAnimationMovesMatchedPieces();
  await testKeyboardTitlesAreDiscoverable();
  await testMoveListSkimmingPlaysSound();
  await testArrowControlLabels();
  await testControlTouchHandlers();
  await testBoardSwipeNavigation();
  await testBoardControlOutlineDismissesOutsideBoard();
  await testEvalChartScrubbing();
  await testMoveSoundsUseAnnotationsAndOverrides();
  await testAssetConfiguration();
  await testCustomEventsAndParserExtensionPoint();
  console.log("tests.js ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
