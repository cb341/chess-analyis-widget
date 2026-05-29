(function () {
  "use strict";

  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  var RANKS_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
  var RANKS_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];
  var PIECE_IMAGES = {
    K: "white-king.svg",
    Q: "white-queen.svg",
    R: "white-rook.svg",
    B: "white-bishop.svg",
    N: "white-knight.svg",
    P: "white-pawn.svg",
    k: "black-king.svg",
    q: "black-queen.svg",
    r: "black-rook.svg",
    b: "black-bishop.svg",
    n: "black-knight.svg",
    p: "black-pawn.svg",
  };
  var PIECE_IMAGE_PATH = "./assets/pieces/cburnett/";
  var SOUNDS = {
    move: "./assets/sounds/move.mp3",
    castle: "./assets/sounds/castle.wav",
    capture: "./assets/sounds/capture.wav",
    check: "./assets/sounds/check.mp3",
    checkmate: "./assets/sounds/checkmate.mp3",
    blunder: "./assets/sounds/blunder.wav",
    mistake: "./assets/sounds/mistake.wav",
    brilliant: "./assets/sounds/brilliant.wav",
    good: "./assets/sounds/good.wav",
  };
  var SCRIPT_URL =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : document.baseURI;
  var ASSET_BASE_URL = new URL(".", SCRIPT_URL);

  function assetUrl(path) {
    return new URL(path, ASSET_BASE_URL).toString();
  }

  function pageUrl(path) {
    return new URL(path, document.baseURI).toString();
  }

  function escapeText(value) {
    return String(value == null ? "" : value);
  }

  function escapeHtml(value) {
    return escapeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hasBooleanAttr(el, name, fallback) {
    if (!el.hasAttribute(name)) return fallback;
    var value = (el.getAttribute(name) || "").toLowerCase();
    return !["false", "0", "off", "no"].includes(value);
  }

  function pieceName(piece) {
    var color = piece === piece.toUpperCase() ? "White" : "Black";
    var names = {
      k: "king",
      q: "queen",
      r: "rook",
      b: "bishop",
      n: "knight",
      p: "pawn",
    };
    return color + " " + (names[piece.toLowerCase()] || "piece");
  }

  function pieceClass(piece) {
    var color = piece === piece.toUpperCase() ? "white" : "black";
    var names = {
      k: "king",
      q: "queen",
      r: "rook",
      b: "bishop",
      n: "knight",
      p: "pawn",
    };
    return color + " " + (names[piece.toLowerCase()] || "piece");
  }

  function fileIndex(square) {
    return FILES.indexOf(square[0]);
  }

  function rankNumber(square) {
    return Number(square[1]);
  }

  function badgeForGlyph(glyph) {
    return {
      "??": { kind: "blunder", label: "??", title: "Blunder" },
      "?": { kind: "mistake", label: "?", title: "Mistake" },
      "!!": { kind: "brilliant", label: "!!", title: "Brilliant move" },
    }[glyph || ""] || null;
  }

  function annotationForGlyph(glyph) {
    return {
      "!!": "brilliant",
      "!": "good",
      "!?": "good",
      "?!": "inaccuracy",
      "?": "mistake",
      "??": "blunder",
    }[glyph || ""] || "";
  }

  function soundForPosition(position) {
    var flags = (position && position.flags) || {};
    var annotation = annotationForGlyph(position && position.glyph);
    if (flags.checkmate) return "checkmate";
    if (flags.capture) return "capture";
    if (flags.check) return "check";
    if (flags.castling) return "castle";
    if (annotation === "blunder" || annotation === "mistake" || annotation === "brilliant" || annotation === "good") return annotation;
    return "move";
  }

  function soundUrl(el, name) {
    var override = el.getAttribute("sound-" + name);
    return override ? pageUrl(override) : assetUrl(SOUNDS[name]);
  }

  function parseGame(pgn) {
    if (!window.ChessPgn || typeof window.ChessPgn.parse !== "function") {
      throw new Error("chess-pgn.js must be loaded before chess-widget.js.");
    }
    return window.ChessPgn.parse(pgn);
  }

  function evalPercent(evaluation) {
    if (!evaluation) return 50;
    if (evaluation.mate) return evaluation.value > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, 50 + evaluation.value * 8));
  }

  function formatEval(evaluation) {
    if (!evaluation) return "";
    if (evaluation.mate) return "#" + evaluation.value;
    return (evaluation.value > 0 ? "+" : "") + evaluation.value.toFixed(2);
  }

  function moveLabel(game, ply) {
    if (!game || ply < 1) return "Starting position";
    var move = game.moves[ply - 1];
    if (!move) return "Position " + ply;
    return move.move_number + (move.color === "black" ? "... " : ". ") + move.san;
  }

  var OBSERVED_ATTRS = [
    "orientation",
    "start",
    "end",
    "ply",
    "sound",
    "eval-chart",
    "eval-bar",
    "clocks",
    "controls",
    "comments",
    "header",
    "moves",
    "minimal",
    "board-only",
  ];

  class ChessWidget extends HTMLElement {
    static get observedAttributes() {
      return OBSERVED_ATTRS;
    }

    static parsePgn(pgn) {
      return parseGame(pgn);
    }

    constructor() {
      super();
      this.game = null;
      this.currentPly = 0;
      this.previousPly = 0;
      this.previousPosition = null;
      this.navigationDirection = "forward";
      this._keyboardBound = false;
      this._activeSound = null;
    }

    connectedCallback() {
      if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
      if (!this.hasAttribute("title")) this.setAttribute("title", "Keyboard: Arrow keys step through moves. Home goes to the first shown move. End goes to the last shown move.");
      this.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Home End");
      this.bindKeyboard();
      this.loadFromAttributes();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue || !this.game) return;
      if (name === "ply") this.goTo(Number(newValue || this.startPly()));
      else this.render();
    }

    bindKeyboard() {
      if (this._keyboardBound) return;
      this._keyboardBound = true;
      this.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          this.previous();
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          this.next();
        } else if (event.key === "Home") {
          event.preventDefault();
          this.start();
        } else if (event.key === "End") {
          event.preventDefault();
          this.end();
        }
      });
    }

    async loadFromAttributes() {
      try {
        var pgn = this.getAttribute("pgn") || this.textContent || "";
        if (this.hasAttribute("src")) {
          var response = await fetch(this.getAttribute("src"));
          if (!response.ok) throw new Error("Unable to fetch PGN.");
          pgn = await response.text();
        }
        this.game = parseGame(pgn);
        this.currentPly = this.resolveInitialPly();
        this.emitWidgetEvent("load", {
          game: this.game,
          ply: this.currentPly,
          source: this.hasAttribute("src") ? this.getAttribute("src") : "inline",
        });
        this.classList.add("cw-widget");
        this.render();
      } catch (error) {
        this.emitWidgetEvent("error", { error: error });
        this.classList.add("cw-widget");
        this.renderError(error.message || "Unable to parse PGN.");
      }
    }

    startPly() {
      return Math.max(0, Number(this.getAttribute("start") || 0) || 0);
    }

    endPly() {
      var max = this.game && this.game.positions ? this.game.positions.length - 1 : 0;
      if (!this.hasAttribute("end")) return max;
      return Math.max(this.startPly(), Math.min(max, Number(this.getAttribute("end") || max) || max));
    }

    resolveInitialPly() {
      var explicit = this.hasAttribute("ply") ? Number(this.getAttribute("ply")) : null;
      var byMove = this.plyForMoveAttribute();
      var ply = explicit == null || Number.isNaN(explicit) ? byMove == null ? this.startPly() : byMove : explicit;
      return this.clampPly(ply);
    }

    plyForMoveAttribute() {
      if (!this.hasAttribute("move")) return null;
      var moveNumber = Number(this.getAttribute("move"));
      var side = (this.getAttribute("side") || "white").toLowerCase();
      var found = this.game.moves.find(function (move) {
        return move.move_number === moveNumber && move.color === side;
      });
      return found ? found.ply : null;
    }

    clampPly(ply) {
      return Math.max(this.startPly(), Math.min(this.endPly(), Number(ply) || 0));
    }

    goTo(ply) {
      if (!this.game) return;
      var target = this.clampPly(ply);
      if (target === this.currentPly) return;
      var distance = Math.abs(target - this.currentPly);
      var fromPly = this.currentPly;
      var fromPosition = this.game.positions[this.currentPly] || null;
      var toPosition = this.game.positions[target] || null;
      if (
        !this.emitWidgetEvent("beforemove", {
          from: fromPly,
          to: target,
          fromPosition: fromPosition,
          toPosition: toPosition,
        })
      ) {
        return;
      }
      this.previousPly = this.currentPly;
      this.previousPosition = fromPosition;
      this.navigationDirection =
        distance > 1 ? "seek" : target >= this.currentPly ? "forward" : "backward";
      this.currentPly = target;
      this.render();
      this.emitWidgetEvent("move", {
        from: fromPly,
        to: target,
        position: toPosition,
        move: this.game.moves[target - 1] || null,
      });
      this.playSoundForPosition(toPosition);
    }

    previous() {
      this.goTo(this.currentPly - 1);
    }

    next() {
      this.goTo(this.currentPly + 1);
    }

    start() {
      this.goTo(this.startPly());
    }

    end() {
      this.goTo(this.endPly());
    }

    playSoundForPosition(position) {
      if (!hasBooleanAttr(this, "sound", false) || !position || typeof window.Audio !== "function") return;
      var name = soundForPosition(position);
      var audio = new window.Audio(soundUrl(this, name));
      if (this._activeSound) this._activeSound.pause();
      this._activeSound = audio;
      audio.play().catch(function () {});
    }

    renderError(message) {
      var fallback = this.textContent.trim();
      this.innerHTML = '<div class="cw-error">' + escapeHtml(message) + (fallback ? "<pre>" + escapeHtml(fallback) + "</pre>" : "") + "</div>";
    }

    render() {
      var game = this.game;
      var position = game.positions[this.currentPly] || game.positions[game.positions.length - 1];
      var whiteShare = evalPercent(position.eval);
      var blackShare = 100 - whiteShare;
      this.innerHTML = "";
      var shell = document.createElement("div");
      shell.className = "cw-shell";
      var boardOnly = hasBooleanAttr(this, "board-only", false);
      var minimal = boardOnly || hasBooleanAttr(this, "minimal", false);
      if (minimal) shell.className += " cw-shell-minimal";
      if (this.featureEnabled("header", true)) shell.appendChild(this.renderHeader(game.metadata));
      var main = document.createElement("div");
      main.className = "cw-main";
      if (minimal) main.className += " cw-main-minimal";
      var boardPanel = document.createElement("div");
      boardPanel.className = "cw-board-panel";
      var boardWithEval = document.createElement("div");
      boardWithEval.className = "cw-board-with-eval";
      boardWithEval.appendChild(this.renderBoard(position));
      if (this.featureEnabled("eval-bar", true)) boardWithEval.appendChild(this.renderEvalBar(whiteShare, blackShare, position.eval));
      boardPanel.appendChild(boardWithEval);
      if (this.featureEnabled("controls", true)) boardPanel.appendChild(this.renderControls(game));
      if (this.featureEnabled("comments", true)) boardPanel.appendChild(this.renderAnnotation(position));
      main.appendChild(boardPanel);
      if (this.featureEnabled("moves", true) || this.featureEnabled("eval-chart", false)) main.appendChild(this.renderSidePanel(game, position));
      shell.appendChild(main);
      var live = document.createElement("div");
      live.className = "cw-live";
      live.setAttribute("aria-live", "polite");
      live.textContent = moveLabel(game, this.currentPly);
      shell.appendChild(live);
      this.appendChild(shell);
      this.emitWidgetEvent("render", {
        ply: this.currentPly,
        position: position,
        move: game.moves[this.currentPly - 1] || null,
      });
    }

    emitWidgetEvent(name, detail) {
      if (typeof CustomEvent !== "function") return true;
      var event = new CustomEvent("chess-widget:" + name, {
        bubbles: true,
        cancelable: name === "beforemove",
        detail: detail,
      });
      return this.dispatchEvent(event);
    }

    featureEnabled(name, normalDefault) {
      if (hasBooleanAttr(this, "board-only", false)) return false;
      if (hasBooleanAttr(this, "minimal", false)) {
        return name === "controls" ? hasBooleanAttr(this, name, true) : hasBooleanAttr(this, name, false);
      }
      return hasBooleanAttr(this, name, normalDefault);
    }

    renderHeader(metadata) {
      var header = document.createElement("header");
      header.className = "cw-header";
      var title = document.createElement("div");
      title.className = "cw-title";
      title.textContent = this.getAttribute("widget-title") || ((metadata.White || "White") + " vs " + (metadata.Black || "Black"));
      var players = document.createElement("div");
      players.className = "cw-players";
      players.innerHTML = "<span>" + escapeHtml(metadata.White || "White") + "</span><strong>" + escapeHtml(metadata.Result || "*") + "</strong><span>" + escapeHtml(metadata.Black || "Black") + "</span>";
      header.appendChild(title);
      header.appendChild(players);
      return header;
    }

    renderBoard(position) {
      var wrap = document.createElement("div");
      var container = document.createElement("cg-container");
      var board = document.createElement("cg-board");
      var orientation = this.getAttribute("orientation") === "black" ? "black" : "white";
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var lastMove = position.last_move || {};
      var previousData = (this.previousPosition && this.previousPosition.board) || {};
      var usedOrigins = {};
      var seekOrigins =
        this.navigationDirection === "seek"
          ? this.seekOriginsForPosition(position.board || {}, previousData)
          : {};
      wrap.className = "cg-wrap cgv1 orientation-" + orientation + " manipulable";
      board.className = "cw-board";
      board.setAttribute("role", "grid");
      board.setAttribute("aria-label", "Chess board");
      container.style.width = "100%";
      container.style.height = "100%";
      ranks.forEach((rank) => {
        files.forEach((file) => {
          var square = file + rank;
          var light = (FILES.indexOf(file) + Number(rank)) % 2 === 1;
          board.appendChild(this.renderBoardSquare(square, "cg-square " + (light ? "light" : "dark")));
        });
      });
      if (lastMove.from) board.appendChild(this.renderBoardSquare(lastMove.from, "last-move"));
      if (lastMove.to) board.appendChild(this.renderBoardSquare(lastMove.to, "last-move"));
      Object.keys(position.board || {}).forEach((square) => {
        var piece = position.board[square];
        var node = document.createElement("piece");
        var animation = this.pieceAnimationState(square, piece, position, previousData, usedOrigins, seekOrigins);
        var toTransform = this.squareTransform(square);
        node.className =
          pieceClass(piece) +
          " cw-piece" +
          (animation.fromTransform !== toTransform ? " cw-piece-arrived" : "") +
          (animation.spawned ? " cw-piece-spawned" : "");
        node.style.setProperty("--cw-transform", toTransform);
        node.style.setProperty("--cw-from-transform", animation.fromTransform);
        node.style.transform = "var(--cw-transform)";
        node.setAttribute("aria-label", square + ", " + pieceName(piece));
        node.appendChild(this.renderPieceImage(piece));
        board.appendChild(node);
      });
      var badge = this.renderMoveBadge(position);
      if (badge) board.appendChild(badge);
      container.appendChild(board);
      container.appendChild(this.renderCoordinates("ranks", ranks));
      container.appendChild(this.renderCoordinates("files", files));
      wrap.appendChild(container);
      return wrap;
    }

    renderMoveBadge(position) {
      if (!hasBooleanAttr(this, "move-badges", true)) return null;
      var badge = badgeForGlyph(position && position.glyph);
      var lastMove = (position && position.last_move) || {};
      if (!badge || !lastMove.to) return null;

      var node = document.createElement("move-marker");
      node.className = "cw-piece-badge cw-piece-badge-" + badge.kind;
      node.title = badge.title;
      node.setAttribute("aria-label", badge.title);
      node.setAttribute("data-badge", badge.kind);
      node.style.setProperty("--cw-transform", this.squareTransform(lastMove.to));
      var label = document.createElement("span");
      label.textContent = this.getAttribute("badge-" + badge.kind) || badge.label;
      node.appendChild(label);
      return node;
    }

    renderBoardSquare(squareName, className) {
      var square = document.createElement("square");
      square.className = className;
      square.style.transform = this.squareTransform(squareName);
      square.setAttribute("aria-hidden", "true");
      return square;
    }

    pieceAnimationState(squareName, piece, position, previousData, usedOrigins, seekOrigins) {
      var targetTransform = this.squareTransform(squareName);
      if (!this.previousPosition || this.previousPly === this.currentPly) {
        return { fromTransform: targetTransform, spawned: false };
      }

      if (this.navigationDirection === "seek") {
        var origin = seekOrigins[squareName];
        if (!origin) return { fromTransform: targetTransform, spawned: true };
        return {
          fromTransform: this.squareTransform(origin),
          spawned: false,
        };
      }

      var currentMove = position && position.last_move ? position.last_move : {};
      var currentFlags = position && position.flags ? position.flags : {};
      var revertedMove =
        this.previousPosition && this.previousPosition.last_move
          ? this.previousPosition.last_move
          : {};
      var revertedFlags =
        this.previousPosition && this.previousPosition.flags
          ? this.previousPosition.flags
          : {};
      var currentRookMove = this.castlingRookMove(currentMove, currentFlags);
      var revertedRookMove = this.castlingRookMove(revertedMove, revertedFlags);

      if (
        this.navigationDirection === "forward" &&
        currentMove.to === squareName &&
        currentMove.from &&
        previousData[currentMove.from] === piece
      ) {
        usedOrigins[currentMove.from] = true;
        return { fromTransform: this.squareTransform(currentMove.from), spawned: false };
      }

      if (
        this.navigationDirection === "forward" &&
        currentRookMove &&
        currentRookMove.to === squareName &&
        previousData[currentRookMove.from] === piece
      ) {
        usedOrigins[currentRookMove.from] = true;
        return { fromTransform: this.squareTransform(currentRookMove.from), spawned: false };
      }

      if (
        this.navigationDirection === "backward" &&
        revertedMove.from === squareName &&
        revertedMove.to &&
        previousData[revertedMove.to] === piece
      ) {
        usedOrigins[revertedMove.to] = true;
        return { fromTransform: this.squareTransform(revertedMove.to), spawned: false };
      }

      if (
        this.navigationDirection === "backward" &&
        revertedRookMove &&
        revertedRookMove.from === squareName &&
        previousData[revertedRookMove.to] === piece
      ) {
        usedOrigins[revertedRookMove.to] = true;
        return { fromTransform: this.squareTransform(revertedRookMove.to), spawned: false };
      }

      if (previousData[squareName] === piece && !usedOrigins[squareName]) {
        usedOrigins[squareName] = true;
        return { fromTransform: targetTransform, spawned: false };
      }

      return { fromTransform: targetTransform, spawned: true };
    }

    seekOriginsForPosition(targetData, previousData) {
      var origins = {};
      var used = {};
      var targets = Object.keys(targetData);

      targets.forEach(function (square) {
        if (previousData[square] === targetData[square]) {
          origins[square] = square;
          used[square] = true;
        }
      });

      targets.forEach(function (square) {
        if (origins[square]) return;
        var piece = targetData[square];
        var best = null;
        var bestDistance = Infinity;
        Object.keys(previousData).forEach(function (candidate) {
          if (used[candidate] || previousData[candidate] !== piece) return;
          var distance =
            Math.abs(fileIndex(square) - fileIndex(candidate)) +
            Math.abs(rankNumber(square) - rankNumber(candidate));
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        });
        if (best) {
          origins[square] = best;
          used[best] = true;
        }
      });

      return origins;
    }

    castlingRookMove(move, flags) {
      if (!move || !flags || !flags.castling || !move.to) return null;

      var rank = move.to.slice(1);
      if (move.to.slice(0, 1) === "g") return { from: "h" + rank, to: "f" + rank };
      if (move.to.slice(0, 1) === "c") return { from: "a" + rank, to: "d" + rank };
      return null;
    }

    squareTransform(squareName) {
      var orientation = this.getAttribute("orientation") === "black" ? "black" : "white";
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      return "translate(" + files.indexOf(squareName[0]) * 100 + "%, " + ranks.indexOf(squareName[1]) * 100 + "%)";
    }

    renderCoordinates(kind, values) {
      var coords = document.createElement("coords");
      coords.className = kind;
      coords.setAttribute("aria-hidden", "true");
      values.forEach(function (value) {
        var coord = document.createElement("coord");
        coord.textContent = value;
        coords.appendChild(coord);
      });
      return coords;
    }

    renderPieceImage(piece) {
      var image = document.createElement("img");
      image.src = assetUrl(PIECE_IMAGE_PATH + PIECE_IMAGES[piece]);
      image.alt = "";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      return image;
    }

    renderEvalBar(whiteShare, blackShare, evaluation) {
      var wrap = document.createElement("div");
      wrap.className = "cw-eval-wrap";
      wrap.innerHTML = '<div class="cw-eval" aria-label="Evaluation ' + escapeHtml(formatEval(evaluation) || "unknown") + '"><div class="cw-eval-black" style="height: ' + blackShare + '%"></div><div class="cw-eval-white" style="height: ' + whiteShare + '%"></div></div><div class="cw-eval-text">' + escapeHtml(formatEval(evaluation) || "No eval") + "</div>";
      return wrap;
    }

    renderAnnotation(position) {
      var box = document.createElement("aside");
      var flags = (position && position.flags) || {};
      var annotation = annotationForGlyph(position && position.glyph);
      box.className =
        "cw-annotation" +
        (flags.capture ? " cw-annotation-capture" : "") +
        (annotation ? " cw-annotation-" + annotation : "");
      var title = document.createElement("strong");
      title.textContent = moveLabel(this.game, this.currentPly);
      var text = document.createElement("span");
      var parts = [];
      if (position.glyph) parts.push(position.glyph);
      if (position.eval) parts.push(formatEval(position.eval));
      if (position.comment) parts.push(position.comment);
      text.textContent = parts.join(" ");
      box.appendChild(title);
      box.appendChild(text);
      if (hasBooleanAttr(this, "clocks", false)) box.appendChild(this.renderClocks());
      return box;
    }

    renderClocks() {
      var clocks = { white: "", black: "" };
      for (var i = 0; i < this.currentPly; i += 1) {
        var move = this.game.moves[i];
        if (move && move.clock) clocks[move.color] = move.clock;
      }
      var node = document.createElement("div");
      node.className = "cw-clocks";
      node.textContent = "White " + (clocks.white || "-") + " Black " + (clocks.black || "-");
      return node;
    }

    renderControls(game) {
      var controls = document.createElement("div");
      controls.className = "cw-controls";
      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "cw-button";
      prev.setAttribute("data-control", "previous");
      prev.textContent = this.controlLabel("previous");
      prev.title = "Previous move. Keyboard: ArrowLeft or ArrowUp.";
      prev.disabled = this.currentPly <= this.startPly();
      prev.addEventListener("touchstart", (event) => this.prepareControlTouch(event), { passive: false });
      prev.addEventListener("touchend", (event) => this.activateControl(event, "previous"), { passive: false });
      prev.addEventListener("click", (event) => this.activateControl(event, "previous"));
      var counter = document.createElement("div");
      counter.className = "cw-counter";
      counter.title = "Moves " + this.startPly() + "-" + this.endPly() + ". Keyboard: Home and End jump to the bounds.";
      counter.textContent = this.currentPly + " / " + this.endPly();
      var next = document.createElement("button");
      next.type = "button";
      next.className = "cw-button";
      next.setAttribute("data-control", "next");
      next.textContent = this.controlLabel("next");
      next.title = "Next move. Keyboard: ArrowRight or ArrowDown.";
      next.disabled = this.currentPly >= this.endPly();
      next.addEventListener("touchstart", (event) => this.prepareControlTouch(event), { passive: false });
      next.addEventListener("touchend", (event) => this.activateControl(event, "next"), { passive: false });
      next.addEventListener("click", (event) => this.activateControl(event, "next"));
      controls.appendChild(prev);
      controls.appendChild(counter);
      controls.appendChild(next);
      return controls;
    }

    prepareControlTouch(event) {
      event.preventDefault();
      this._controlTouchStarted = true;
    }

    activateControl(event, direction) {
      if (event.type === "click" && this._suppressNextControlClick) {
        event.preventDefault();
        this._suppressNextControlClick = false;
        return;
      }

      if (event.type === "touchend") {
        event.preventDefault();
        this._suppressNextControlClick = true;
        if (!this._controlTouchStarted) return;
        this._controlTouchStarted = false;
      }

      if (direction === "previous") this.previous();
      else this.next();
    }

    controlLabel(kind) {
      if (this.getAttribute("control-style") === "arrows") {
        return kind === "previous" ? "<" : ">";
      }
      return kind === "previous" ? "Previous" : "Next";
    }

    renderSidePanel(game, position) {
      var side = document.createElement("aside");
      side.className = "cw-side";
      if (this.featureEnabled("eval-chart", false) && game.moves.some(function (move) { return move.eval; })) {
        side.appendChild(this.renderPanel("Eval over time", this.renderEvalChart(game)));
      }
      if (this.featureEnabled("moves", true)) side.appendChild(this.renderPanel("Moves", this.renderMoveList(game)));
      return side;
    }

    renderPanel(title, content) {
      var details = document.createElement("details");
      details.className = "cw-panel";
      details.open = true;
      var summary = document.createElement("summary");
      summary.textContent = title;
      details.appendChild(summary);
      details.appendChild(content);
      return details;
    }

    renderEvalChart(game) {
      var section = document.createElement("div");
      var width = 320;
      var height = 86;
      var points = game.positions.map(function (position, index) {
        var x = game.positions.length <= 1 ? 0 : (index / (game.positions.length - 1)) * width;
        var y = height - (evalPercent(position.eval) / 100) * height;
        return x + "," + y;
      });
      section.className = "cw-chart";
      section.innerHTML = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Evaluation over time"><rect class="cw-chart-white" x="0" y="0" width="' + width + '" height="' + height / 2 + '"></rect><rect class="cw-chart-black" x="0" y="' + height / 2 + '" width="' + width + '" height="' + height / 2 + '"></rect><line class="cw-chart-zero" x1="0" y1="' + height / 2 + '" x2="' + width + '" y2="' + height / 2 + '"></line><polyline class="cw-chart-line" points="' + points.join(" ") + '"></polyline><line class="cw-chart-current" x1="' + this.chartX(width, game.positions.length) + '" y1="0" x2="' + this.chartX(width, game.positions.length) + '" y2="' + height + '"></line></svg>';
      return section;
    }

    chartX(width, count) {
      return count <= 1 ? 0 : (this.currentPly / (count - 1)) * width;
    }

    renderMoveList(game) {
      var section = document.createElement("div");
      section.className = "cw-moves";
      var list = document.createElement("div");
      list.className = "cw-move-list";
      var visible = game.moves.filter((move) => move.ply >= this.startPly() && move.ply <= this.endPly());
      var rows = [];
      visible.forEach(function (move) {
        var row = rows.find(function (item) {
          return item.moveNumber === move.move_number;
        });
        if (!row) {
          row = { moveNumber: move.move_number, white: null, black: null };
          rows.push(row);
        }
        row[move.color] = move;
      });
      rows.forEach((moveRow) => {
        var row = document.createElement("div");
        row.className = "cw-move-row";
        var number = document.createElement("span");
        number.className = "cw-move-number";
        number.textContent = moveRow.moveNumber + ".";
        row.appendChild(number);
        row.appendChild(moveRow.white ? this.renderMoveButton(moveRow.white) : document.createElement("span"));
        row.appendChild(moveRow.black ? this.renderMoveButton(moveRow.black) : document.createElement("span"));
        list.appendChild(row);
      });
      section.appendChild(list);
      return section;
    }

    renderMoveButton(move) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "cw-move" + (move.ply === this.currentPly ? " cw-active-move" : "");
      button.title = "Go to " + moveLabel(this.game, move.ply) + ". Keyboard: arrow keys continue from there.";
      button.addEventListener("click", () => this.goTo(move.ply));
      var san = document.createElement("span");
      san.textContent = move.san;
      var mark = document.createElement("span");
      mark.className = "cw-mark";
      mark.textContent = move.glyph || "";
      button.appendChild(san);
      button.appendChild(mark);
      return button;
    }
  }

  if (!customElements.get("chess-widget")) customElements.define("chess-widget", ChessWidget);
})();
