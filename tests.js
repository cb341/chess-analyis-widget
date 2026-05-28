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
      add() {},
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
    addEventListener() {},
  };
}

global.document = {
  baseURI: "file:///tmp/",
  currentScript: { src: "file:///tmp/chess-widget.js" },
  createElement: createNode,
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
    this.textContent = "";
    this.classList = { add() {} };
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

  addEventListener() {}
};

global.window = {};

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
  const widget = await loadPgn(fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8"));
  assert.equal(widget.game.metadata.White, "Ada");
  assert.equal(widget.game.metadata.Black, "Grace");
  assert.equal(widget.game.metadata.WhiteElo, "1650");
  assert.equal(widget.game.metadata.BlackElo, "1620");
  assert.equal(widget.game.moves.length, 51);
  assert.equal(widget.game.positions.length, 52);
  assert.equal(widget.game.moves[0].comment, "White takes the center.");
  assert.deepEqual(widget.game.moves[0].eval, { value: 0.2, mate: false });
  assert.equal(widget.game.moves[0].clock, "0:05:00");
  assert.deepEqual(widget.game.moves[46].eval, { value: 5, mate: true });
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
  const pgn = fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8");
  global.fetch = async function (url) {
    assert.equal(url, "/assets/games/blitz-checkmate.pgn");
    return {
      ok: true,
      async text() {
        return pgn;
      },
    };
  };
  const widget = await loadPgn("See the annotated game on the site", {
    src: "/assets/games/blitz-checkmate.pgn",
  });
  assert.equal(widget.game.metadata.White, "Ada");
  assert.equal(widget.game.moves[0].san, "e4");
  delete global.fetch;
}

async function testMoveListGroupsByMoveNumber() {
  const widget = await loadPgn(fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8"), {
    start: "2",
    end: "5",
  });
  const list = widget.renderMoveList(widget.game).children[0];
  assert.equal(list.children.length, 3);
  assert.equal(list.children[0].children[0].textContent, "1.");
  assert.equal(list.children[0].children[1].tagName, "span");
  assert.equal(list.children[0].children[2].children[0].textContent, "e5");
  assert.equal(list.children[1].children[0].textContent, "2.");
  assert.equal(list.children[1].children[1].children[0].textContent, "Nf3");
  assert.equal(list.children[1].children[2].children[0].textContent, "Nc6");
  assert.equal(list.children[2].children[0].textContent, "3.");
  assert.equal(list.children[2].children[1].children[0].textContent, "Bb5");
  assert.equal(list.children[2].children[2].tagName, "span");
}

async function testMinimalModeIsControlsOnly() {
  const widget = await loadPgn(fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8"), {
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
  const widget = await loadPgn(fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8"), {
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
  const widget = await loadPgn(fs.readFileSync("assets/games/blitz-checkmate.pgn", "utf8"), {
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

async function run() {
  await testSamplePgn();
  await testCommentAttachmentAndGlyphs();
  await testFenStartAndBounds();
  await testPromotionAndEnPassant();
  await testSrcWinsOverFallback();
  await testMoveListGroupsByMoveNumber();
  await testMinimalModeIsControlsOnly();
  await testBoardOnlyModeKeepsOnlyBoard();
  await testFalseFeatureAttributesHideFeatures();
  console.log("tests.js ok");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
