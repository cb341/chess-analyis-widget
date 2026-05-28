(function () {
  "use strict";

  async function decompressJson(base64) {
    var bytes = Uint8Array.from(atob(base64), function (c) {
      return c.charCodeAt(0);
    });
    var stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    var text = await new Response(stream).text();
    return JSON.parse(text);
  }

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

  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  var RANKS_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
  var RANKS_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];

  function fenToBoard(fen) {
    if (!fen || typeof fen !== "string") return {};
    var placement = fen.split(" ")[0];
    var board = {};
    var rank = 8;
    var file = 0;
    for (var i = 0; i < placement.length; i++) {
      var ch = placement[i];
      if (ch === "/") {
        rank -= 1;
        file = 0;
      } else if (ch >= "1" && ch <= "8") {
        file += parseInt(ch, 10);
      } else {
        board[FILES[file] + rank] = ch;
        file += 1;
      }
    }
    return board;
  }

  function positionBoard(position) {
    if (position && position.fen) return fenToBoard(position.fen);
    if (position && position.board && typeof position.board === "object") return position.board;
    return {};
  }
  var MARKS = {
    book: "book",
    good: "!",
    great: "!",
    great_move: "!",
    greatmove: "!",
    mistake: "?",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#",
  };
  var BOARD_MARKERS = {
    book: "book",
    good: "!",
    mistake: "?!",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#",
  };
  var SOUNDS = {
    move: "./assets/sounds/move.mp3",
    castle: "./assets/sounds/castle.wav",
    capture: "./assets/sounds/capture.wav",
    check: "./assets/sounds/check.mp3",
    checkmate: "./assets/sounds/checkmate.mp3",
    book: "./assets/sounds/book.wav",
    forced: "./assets/sounds/forced.wav",
    good: "./assets/sounds/good.wav",
    great: "./assets/sounds/great.wav",
    brilliant: "./assets/sounds/brilliant.wav",
    mistake: "./assets/sounds/mistake.wav",
    inaccuracy: "./assets/sounds/mistake.wav",
    blunder: "./assets/sounds/blunder.wav",
    solid: "./assets/sounds/good.wav",
  };
  var SCRIPT_URL =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : document.baseURI;
  var ASSET_BASE_URL = new URL(".", SCRIPT_URL);

  function clampPercent(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
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

  function annotationClass(kind) {
    if (!kind) return "";
    return (
      "cw-annotation-" +
      String(kind)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
    );
  }

  function annotationMark(kind) {
    return MARKS[kind] || "·";
  }

  function annotationFor(position) {
    if (!position) return {};
    if (position.annotation_detail) return position.annotation_detail;
    if (position.annotation && typeof position.annotation === "object") {
      return position.annotation;
    }
    if (typeof position.annotation === "string") {
      return {
        kind: position.annotation,
        label: position.annotation,
        text: "",
      };
    }

    return {};
  }

  function moveLabel(game, ply) {
    if (!game || !Array.isArray(game.moves) || ply < 1)
      return "Starting position";
    var move = game.moves[ply - 1];
    if (!move) return "Position " + ply;
    var prefix = move.color === "black" ? "... " : ". ";
    return move.move_number + prefix + move.san;
  }

  function assetUrl(path) {
    return new URL(path, ASSET_BASE_URL).toString();
  }

  var OBSERVED_ATTRS = [
    "orientation", "widget-title", "open-panels", "collapsed-panels",
    "hidden-panels", "sound", "initial-ply",
  ];

  class ChessWidget extends HTMLElement {
    static get observedAttributes() { return OBSERVED_ATTRS; }

    constructor() {
      super();
      this.game = null;
      this.currentPly = 0;
      this.previousPly = 0;
      this.previousPosition = null;
      this.navigationDirection = "forward";
      this._keyboardBound = false;
      this._focusBound = false;
      this._soundSources = {};
      this._activeSound = null;
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (!this.game) return;
      this._openPanelState = null;
      this.render();
    }

    connectedCallback() {
      if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
      this.setAttribute(
        "aria-keyshortcuts",
        "ArrowLeft ArrowRight ArrowUp ArrowDown Home End Space",
      );
      this.classList.add("cw-widget");
      this.bindKeyboard();
      this.bindFocus();
      this.loadFromSource();
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
        } else if (event.key === " " || event.key === "Spacebar") {
          event.preventDefault();
          this.play();
        }
      });
    }

    bindFocus() {
      if (this._focusBound) return;
      this._focusBound = true;
      this.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;
        this.focus({ preventScroll: true });
      });
    }

    loadFromSource() {
      var sourceId = this.getAttribute("data-source");
      var source = sourceId && document.getElementById(sourceId);

      if (!source) {
        this.renderError("Unable to load chess data.");
        return;
      }

      if (source.type === "application/x-gzip-json") {
        decompressJson(source.textContent.trim()).then(
          (data) => this.load(data),
          () => this.renderError("Invalid chess data."),
        );
      } else {
        try {
          this.load(JSON.parse(source.textContent || ""));
        } catch {
          this.renderError("Invalid chess data.");
        }
      }
    }

    load(gameData) {
      this.game = gameData && typeof gameData === "object" ? gameData : null;
      var maxPly = this.game && Array.isArray(this.game.positions) ? this.game.positions.length - 1 : 0;
      var initialPly = Number(this.getAttribute("initial-ply") || 0);
      this.currentPly = Math.min(Math.max(0, initialPly), maxPly);

      if (
        !this.game ||
        !Array.isArray(this.game.positions) ||
        this.game.positions.length === 0
      ) {
        this.renderError("No chess positions available.");
        return;
      }

      this.render();
    }

    goTo(ply) {
      if (!this.game || !Array.isArray(this.game.positions)) return;
      var target = Math.max(
        0,
        Math.min(this.game.positions.length - 1, Number(ply) || 0),
      );
      if (target === this.currentPly) return;
      this.previousPly = this.currentPly;
      this.previousPosition = this.game.positions[this.currentPly] || null;
      this.navigationDirection =
        target >= this.currentPly ? "forward" : "backward";
      this.currentPly = target;
      this.render();
      this.playSoundForPosition(this.game.positions[target]);
    }

    playSoundForPosition(position) {
      if (this.getAttribute("sound") === "off" || !position) return;
      var soundName = "move";
      var flags = position.flags || {};
      var lastMove = position.last_move || {};
      var move = this.moveForPosition(position);
      var annotation = this.soundAnnotationKind(position, move);
      var isCastling =
        this.flagEnabled(flags.castling) ||
        this.flagEnabled(lastMove.castling) ||
        this.flagEnabled(lastMove.flags && lastMove.flags.castling) ||
        this.sanIsCastling(move && move.san);
      var isCapture =
        this.flagEnabled(flags.capture) ||
        this.flagEnabled(lastMove.capture) ||
        this.flagEnabled(lastMove.captured) ||
        this.flagEnabled(lastMove.flags && lastMove.flags.capture) ||
        this.sanIsCapture(move && move.san);

      if (annotation && SOUNDS[annotation]) {
        soundName = annotation;
      } else if (this.flagEnabled(flags.checkmate)) {
        soundName = "checkmate";
      } else if (isCapture) {
        soundName = "capture";
      } else if (this.flagEnabled(flags.check)) {
        soundName = "check";
      } else if (isCastling) {
        soundName = "castle";
      }

      this.setAttribute("data-sound-current", soundName);
      this.playSound(soundName);
    }

    soundAnnotationKind(position, move) {
      var annotation = annotationFor(position);
      var kind = annotation.kind || (move && move.annotation);
      if (!kind) return null;

      kind = String(kind)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (kind === "great_move" || kind === "greatmove") return "great";
      return kind;
    }

    flagEnabled(value) {
      return value === true || value === "true" || value === 1 || value === "1";
    }

    moveForPosition(position) {
      var moves = Array.isArray(this.game && this.game.moves)
        ? this.game.moves
        : [];
      return moves[(position.ply || 0) - 1] || null;
    }

    sanIsCapture(san) {
      return typeof san === "string" && san.indexOf("x") !== -1;
    }

    sanIsCastling(san) {
      return typeof san === "string" && /^O-O(?:-O)?[+#]?$/.test(san);
    }

    playSound(name) {
      var source = SOUNDS[name];
      if (!source || typeof window.Audio !== "function") return;
      if (!this._soundSources[name])
        this._soundSources[name] = assetUrl(source);

      this.stopActiveSound();
      var audio = new window.Audio(this._soundSources[name]);
      audio.preload = "auto";
      audio.volume = 1;
      audio.addEventListener("ended", () => this.clearActiveSound(audio), {
        once: true,
      });
      this._activeSound = audio;

      var attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch((error) => {
          this.setAttribute("data-sound-error", error.name || "blocked");
          this.clearActiveSound(audio);
        });
      }
    }

    stopActiveSound() {
      if (!this._activeSound) return;
      this._activeSound.pause();
      this._activeSound.currentTime = 0;
      this._activeSound = null;
    }

    clearActiveSound(audio) {
      if (this._activeSound === audio) this._activeSound = null;
    }

    next() {
      this.goTo(this.currentPly + 1);
    }

    previous() {
      this.goTo(this.currentPly - 1);
    }

    play() {
      if (!this.game || !Array.isArray(this.game.positions)) return;
      if (this.currentPly < this.game.positions.length - 1) {
        this.next();
        return;
      }

      this.replayCurrent();
    }

    replayCurrent() {
      if (!this.game || this.currentPly < 1) return;
      this.previousPly = this.currentPly - 1;
      this.previousPosition = this.game.positions[this.previousPly] || null;
      this.navigationDirection = "forward";
      this.render();
      this.playSoundForPosition(this.game.positions[this.currentPly]);
    }

    start() {
      this.goTo(0);
    }

    end() {
      if (!this.game || !Array.isArray(this.game.positions)) return;
      this.goTo(this.game.positions.length - 1);
    }

    renderError(message) {
      this.innerHTML = "";
      var error = document.createElement("div");
      error.className = "cw-error";
      error.textContent = message;
      this.appendChild(error);
    }

    render() {
      var game = this.game;
      var positions = Array.isArray(game && game.positions)
        ? game.positions
        : [];
      var position = positions[this.currentPly] || {};
      var metadata = game.metadata || {};
      var annotation = annotationFor(position);
      var whiteEval = clampPercent(
        position.eval_bar && position.eval_bar.white,
        50,
      );
      var blackEval = clampPercent(
        position.eval_bar && position.eval_bar.black,
        100 - whiteEval,
      );
      var total = whiteEval + blackEval;
      var whiteShare = total > 0 ? Math.round((whiteEval / total) * 100) : 50;
      var blackShare = 100 - whiteShare;

      this._openPanelState = this._openPanelState || null;
      var hadPanels = !!this.querySelector("[data-panel]");
      if (hadPanels) {
        this._openPanelState = {};
        this.querySelectorAll("[data-panel]").forEach(function (el) {
          this._openPanelState[el.getAttribute("data-panel")] = el.open;
        }, this);
      }

      this.innerHTML = "";

      var shell = document.createElement("div");
      shell.className = "cw-shell";

      shell.appendChild(this.renderHeader(metadata));

      var main = document.createElement("div");
      main.className = "cw-main";

      var boardPanel = document.createElement("div");
      boardPanel.className = "cw-board-panel";

      var boardWithEval = document.createElement("div");
      boardWithEval.className = "cw-board-with-eval";
      boardWithEval.appendChild(this.renderBoard(position));
      if (!this.panelHidden("eval")) {
        boardWithEval.appendChild(this.renderEvalBar(whiteShare, blackShare));
      }
      boardPanel.appendChild(boardWithEval);

      if (!this.panelHidden("controls")) {
        boardPanel.appendChild(this.renderControls(game));
      }
      boardPanel.appendChild(this.renderAnnotation(annotation));
      boardPanel.appendChild(this.renderBookmarks(game));
      main.appendChild(boardPanel);

      main.appendChild(
        this.renderSidePanel(game, position, whiteShare, blackShare),
      );
      shell.appendChild(main);

      var live = document.createElement("div");
      live.className = "cw-live";
      live.setAttribute("aria-live", "polite");
      live.textContent = moveLabel(game, this.currentPly);
      shell.appendChild(live);

      this.appendChild(shell);
    }

    renderHeader(metadata) {
      var header = document.createElement("header");
      header.className = "cw-header";

      var title = document.createElement("div");
      title.className = "cw-title";
      title.textContent = this.widgetTitle(metadata);

      var players = document.createElement("div");
      players.className = "cw-players";

      var white = document.createElement("span");
      white.textContent =
        escapeText(metadata.White || "White") +
        " (" +
        escapeText(metadata.WhiteElo || "-") +
        ")";
      var result = document.createElement("strong");
      result.textContent = escapeText(metadata.Result || "*");
      var black = document.createElement("span");
      black.textContent =
        escapeText(metadata.Black || "Black") +
        " (" +
        escapeText(metadata.BlackElo || "-") +
        ")";

      header.appendChild(title);
      if (!this.authorHidden()) {
        players.appendChild(white);
        players.appendChild(result);
        players.appendChild(black);
        header.appendChild(players);
      }
      return header;
    }

    widgetTitle(metadata) {
      var custom = this.getAttribute("widget-title") || this.getAttribute("title");
      if (custom) return escapeText(custom);
      var white = metadata.White || "White";
      var black = metadata.Black || "Black";
      return escapeText(white + " vs " + black);
    }

    authorHidden() {
      var value = this.getAttribute("show-author");
      return (
        this.hasAttribute("hide-author") ||
        this.hasAttribute("hide-players") ||
        (value && value.toLowerCase() === "false")
      );
    }

    renderBoard(position) {
      var wrap = document.createElement("div");
      var container = document.createElement("cg-container");
      var board = document.createElement("cg-board");
      var orientation =
        this.getAttribute("orientation") === "black" ? "black" : "white";
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var boardData = positionBoard(position);
      var annotation = annotationFor(position);
      var lastMoveClass =
        "last-move " + annotationClass(annotation.kind || "good");
      var previousData = positionBoard(this.previousPosition);
      var lastMove = position && position.last_move ? position.last_move : {};
      var usedOrigins = {};

      wrap.className =
        "cg-wrap cgv1 orientation-" + orientation + " manipulable";
      board.className = "cw-board";
      board.setAttribute("role", "grid");
      board.setAttribute("aria-label", "Chess board");
      container.style.width = "100%";
      container.style.height = "100%";

      for (var sr = 0; sr < ranks.length; sr += 1) {
        for (var sf = 0; sf < files.length; sf += 1) {
          var baseSquareName = files[sf] + ranks[sr];
          var fileIndex = FILES.indexOf(files[sf]);
          var rankNumber = Number(ranks[sr]);
          var light = (fileIndex + rankNumber) % 2 === 1;
          board.appendChild(
            this.renderBoardSquare(
              baseSquareName,
              "cg-square " + (light ? "light" : "dark"),
            ),
          );
        }
      }

      if (lastMove.from) {
        board.appendChild(this.renderBoardSquare(lastMove.from, lastMoveClass));
      }
      if (lastMove.to) {
        board.appendChild(this.renderBoardSquare(lastMove.to, lastMoveClass));
      }
      if (position && position.flags && position.flags.check) {
        board.appendChild(
          this.renderBoardSquare(
            this.checkedKingSquare(position, boardData) || lastMove.to,
            "check",
          ),
        );
      }

      for (var r = 0; r < ranks.length; r += 1) {
        for (var f = 0; f < files.length; f += 1) {
          var squareName = files[f] + ranks[r];
          var piece = boardData[squareName];

          if (PIECE_IMAGES[piece]) {
            var marker = this.renderBoardMarker(position, squareName);
            if (marker) board.appendChild(marker);

            var pieceNode = document.createElement("piece");
            var animation = this.pieceAnimationState(
              squareName,
              piece,
              position,
              previousData,
              usedOrigins,
            );
            var toTransform = this.squareTransform(squareName);
            pieceNode.className =
              pieceClass(piece) +
              " cw-piece" +
              (animation.fromTransform !== toTransform
                ? " cw-piece-arrived"
                : "") +
              (animation.spawned ? " cw-piece-spawned" : "");
            pieceNode.style.setProperty("--cw-transform", toTransform);
            pieceNode.style.setProperty(
              "--cw-from-transform",
              animation.fromTransform,
            );
            pieceNode.style.transform = "var(--cw-transform)";
            pieceNode.setAttribute(
              "aria-label",
              squareName + ", " + pieceName(piece),
            );
            pieceNode.appendChild(this.renderPieceImage(piece));
            board.appendChild(pieceNode);
            if (squareName === lastMove.to && annotation.kind && annotation.kind !== "good") {
              var badge = document.createElement("span");
              badge.className = "cw-piece-badge " + annotationClass(annotation.kind);
              badge.style.setProperty("--cw-transform", toTransform);
              badge.style.transform = "var(--cw-transform)";
              badge.textContent = annotationMark(annotation.kind);
              badge.setAttribute("aria-hidden", "true");
              board.appendChild(badge);
            }
          }
        }
      }

      container.appendChild(board);
      container.appendChild(this.renderCoordinates("ranks", ranks));
      container.appendChild(this.renderCoordinates("files", files));
      wrap.appendChild(container);
      return wrap;
    }

    renderBoardSquare(squareName, className) {
      if (!squareName) return document.createElement("square");

      var square = document.createElement("square");
      square.className = className;
      square.style.transform = this.squareTransform(squareName);
      square.setAttribute("aria-hidden", "true");
      return square;
    }

    pieceAnimationState(
      squareName,
      piece,
      position,
      previousData,
      usedOrigins,
    ) {
      var targetTransform = this.squareTransform(squareName);
      if (!this.previousPosition || this.previousPly === this.currentPly) {
        return { fromTransform: targetTransform, spawned: false };
      }

      var currentMove =
        position && position.last_move ? position.last_move : {};
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
        return {
          fromTransform: this.squareTransform(currentMove.from),
          spawned: false,
        };
      }

      if (
        this.navigationDirection === "forward" &&
        currentRookMove &&
        currentRookMove.to === squareName &&
        previousData[currentRookMove.from] === piece
      ) {
        usedOrigins[currentRookMove.from] = true;
        return {
          fromTransform: this.squareTransform(currentRookMove.from),
          spawned: false,
        };
      }

      if (
        this.navigationDirection === "backward" &&
        revertedMove.from === squareName &&
        revertedMove.to &&
        previousData[revertedMove.to] === piece
      ) {
        usedOrigins[revertedMove.to] = true;
        return {
          fromTransform: this.squareTransform(revertedMove.to),
          spawned: false,
        };
      }

      if (
        this.navigationDirection === "backward" &&
        revertedRookMove &&
        revertedRookMove.from === squareName &&
        previousData[revertedRookMove.to] === piece
      ) {
        usedOrigins[revertedRookMove.to] = true;
        return {
          fromTransform: this.squareTransform(revertedRookMove.to),
          spawned: false,
        };
      }

      if (previousData[squareName] === piece && !usedOrigins[squareName]) {
        usedOrigins[squareName] = true;
        return { fromTransform: targetTransform, spawned: false };
      }

      return { fromTransform: targetTransform, spawned: true };
    }

    castlingRookMove(move, flags) {
      if (!move || !flags || !flags.castling || !move.to) return null;

      var rank = move.to.slice(1);
      if (move.to.slice(0, 1) === "g") {
        return { from: "h" + rank, to: "f" + rank };
      }
      if (move.to.slice(0, 1) === "c") {
        return { from: "a" + rank, to: "d" + rank };
      }

      return null;
    }

    checkedKingSquare(position, boardData) {
      var moves = Array.isArray(this.game && this.game.moves)
        ? this.game.moves
        : [];
      var move = moves[(position.ply || 0) - 1] || {};
      var king = move.color === "white" ? "k" : "K";

      for (var squareName in boardData) {
        if (boardData[squareName] === king) return squareName;
      }

      return null;
    }

    squareTransform(squareName) {
      var orientation =
        this.getAttribute("orientation") === "black" ? "black" : "white";
      var file = squareName.slice(0, 1);
      var rank = squareName.slice(1);
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      var fileIndex = files.indexOf(file);
      var rankIndex = ranks.indexOf(rank);

      return "translate(" + fileIndex * 100 + "%, " + rankIndex * 100 + "%)";
    }

    renderCoordinates(kind, values) {
      var coords = document.createElement("coords");
      coords.className = kind;
      coords.setAttribute("aria-hidden", "true");

      for (var i = 0; i < values.length; i += 1) {
        var coord = document.createElement("coord");
        coord.className = i % 2 === 0 ? "coord-dark" : "coord-light";
        coord.textContent = values[i];
        coords.appendChild(coord);
      }

      return coords;
    }

    renderBoardMarker(position, squareName) {
      var lastMove = position && position.last_move ? position.last_move : {};
      var annotation = annotationFor(position);
      var kind = annotation.kind || "good";
      var mark = BOARD_MARKERS[kind];

      if (lastMove.to !== squareName || !mark) return null;

      var marker = document.createElement("move-marker");
      marker.className = "cw-board-marker " + annotationClass(kind);
      marker.style.setProperty(
        "--cw-transform",
        this.squareTransform(squareName),
      );
      marker.style.transform = "var(--cw-transform)";
      marker.setAttribute("data-mark", mark);
      marker.textContent = mark;
      marker.setAttribute("aria-hidden", "true");
      return marker;
    }

    renderPieceImage(piece) {
      var image = document.createElement("img");
      image.src = assetUrl(PIECE_IMAGE_PATH + PIECE_IMAGES[piece]);
      image.alt = "";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      return image;
    }

    renderAnnotation(annotation) {
      var box = document.createElement("aside");
      var kind = annotation.kind || "good";
      box.className = "cw-annotation " + annotationClass(kind);

      var label = document.createElement("strong");
      label.textContent = escapeText(annotation.label || "Position");
      var text = document.createElement("span");
      text.textContent = escapeText(
        annotation.text || "No annotation for this position.",
      );

      box.appendChild(label);
      box.appendChild(text);
      return box;
    }

    renderSidePanel(game, position, whiteShare, blackShare) {
      var side = document.createElement("aside");
      side.className = "cw-side";
      side.innerHTML = `
        <div data-slot="chart"></div>
        <div data-slot="current"></div>
        <div data-slot="summary"></div>
        <div data-slot="moves"></div>
      `;

      var hasSummary = game.summary && game.summary.trim().length > 0;
      var currentComment = position && position.pgn_comment && position.pgn_comment.trim();
      var panels = [
        ["chart", "Eval over time", this.renderEvalChart(game), true],
        currentComment ? ["current", moveLabel(game, this.currentPly), this.renderCurrent(position), true] : null,
        ["moves", "Moves", this.renderMoveList(game), true],
        hasSummary ? ["summary", "Summary", this.renderSummary(game), true] : null,
      ].filter(Boolean);
      panels.forEach(function (panel) {
        var name = panel[0], title = panel[1], content = panel[2], defaultOpen = panel[3];
        var slot = side.querySelector('[data-slot="' + name + '"]');
        if (this.panelHidden(name)) {
          slot.remove();
        } else {
          slot.replaceWith(this.renderCollapsible(title, name, content, defaultOpen));
        }
      }, this);
      return side;
    }

    renderCollapsible(title, name, content, openByDefault) {
      var details = document.createElement("details");
      details.className = "cw-panel cw-panel-" + name;
      details.setAttribute("data-panel", name);
      if (this.panelOpen(name, openByDefault)) details.open = true;

      var summary = document.createElement("summary");
      summary.textContent = title;
      details.appendChild(summary);
      details.appendChild(content);
      return details;
    }

    panelHidden(name) {
      return this.panelNamesFromAttribute("hidden-panels")[name] || false;
    }

    panelOpen(name, defaultOpen) {
      var openPanels = this.panelNamesFromAttribute("open-panels");
      var collapsedPanels = this.panelNamesFromAttribute("collapsed-panels");
      if (openPanels[name]) return true;
      if (collapsedPanels[name]) return false;
      if (this.hasAttribute(name + "-open")) return true;
      if (this.hasAttribute(name + "-collapsed")) return false;
      if (this._openPanelState && name in this._openPanelState) return !!this._openPanelState[name];
      return defaultOpen;
    }

    panelNamesFromAttribute(attributeName) {
      var value = this.getAttribute(attributeName) || "";
      return value
        .split(/[\s,]+/)
        .filter(Boolean)
        .reduce(function (names, name) {
          names[name.toLowerCase()] = true;
          return names;
        }, {});
    }

    renderEvalBar(whiteShare, blackShare) {
      var wrap = document.createElement("div");
      wrap.className = "cw-eval-wrap";
      wrap.innerHTML = `
        <div
          class="cw-eval"
          aria-label="Evaluation: White ${whiteShare} percent, Black ${blackShare} percent"
        >
          <div class="cw-eval-black" style="height: ${blackShare}%"></div>
          <div class="cw-eval-white" style="height: ${whiteShare}%"></div>
        </div>
        <div class="cw-eval-text">White ${whiteShare}%</div>
      `;
      return wrap;
    }

    renderCurrent(position) {
      var section = document.createElement("div");
      section.className = "cw-current-body";
      var text = (position && position.pgn_comment) || "";
      section.innerHTML = `<p>${escapeHtml(text)}</p>`;
      return section;
    }

    renderSummary(game) {
      var section = document.createElement("div");
      section.className = "cw-summary-body";
      section.innerHTML = `<p>${escapeHtml(game.summary || "")}</p>`;
      return section;
    }

    renderControls(game) {
      var controls = document.createElement("div");
      controls.className = "cw-controls";

      var prev = document.createElement("button");
      prev.type = "button";
      prev.className = "cw-button";
      prev.textContent = "Previous";
      prev.disabled = this.currentPly <= 0;
      prev.addEventListener("click", () => this.previous());

      var counter = document.createElement("div");
      counter.className = "cw-counter";
      counter.textContent =
        this.currentPly +
        " / " +
        Math.max(0, (game.positions || []).length - 1);

      var next = document.createElement("button");
      next.type = "button";
      next.className = "cw-button";
      next.textContent = "Next";
      next.disabled = this.currentPly >= (game.positions || []).length - 1;
      next.addEventListener("click", () => this.next());

      controls.appendChild(prev);
      controls.appendChild(counter);
      controls.appendChild(next);
      return controls;
    }

    renderEvalChart(game) {
      var section = document.createElement("div");
      var positions = Array.isArray(game.positions) ? game.positions : [];
      var width = 320;
      var height = 86;
      var points = positions.map(function (position, index) {
        var white = clampPercent(
          position.eval_bar && position.eval_bar.white,
          50,
        );
        var x =
          positions.length <= 1 ? 0 : (index / (positions.length - 1)) * width;
        var y = height - (white / 100) * height;
        return x + "," + y;
      });

      section.className = "cw-chart";
      section.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Evaluation over time">
          <rect class="cw-chart-white" x="0" y="0" width="${width}" height="${height / 2}"></rect>
          <rect class="cw-chart-black" x="0" y="${height / 2}" width="${width}" height="${height / 2}"></rect>
          <line class="cw-chart-zero" x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"></line>
          <polyline class="cw-chart-line" points="${points.join(" ")}"></polyline>
          <line class="cw-chart-current" x1="${this.chartX(width, positions.length)}" y1="0" x2="${this.chartX(width, positions.length)}" y2="${height}"></line>
        </svg>
      `;
      return section;
    }

    chartX(width, count) {
      return count <= 1 ? 0 : (this.currentPly / (count - 1)) * width;
    }

    renderMoveList(game) {
      var section = document.createElement("div");
      section.className = "cw-moves";

      var allMoves = Array.isArray(game.moves) ? game.moves : [];
      var interestingKinds = {blunder: 1, brilliant: 1, mistake: 1, inaccuracy: 1, checkmate: 1};
      var hasInteresting = allMoves.some(function (m) { return interestingKinds[m.annotation]; });

      var showAll = true;

      var buildList = function (moves) {
        var list = document.createElement("div");
        list.className = "cw-move-list";
        for (var i = 0; i < moves.length; i += 2) {
          var row = document.createElement("div");
          row.className = "cw-move-row";
          var number = document.createElement("span");
          number.className = "cw-move-number";
          number.textContent = escapeText(moves[i].move_number || Math.floor(i / 2) + 1) + ".";
          row.appendChild(number);
          row.appendChild(this.renderMoveButton(moves[i]));
          if (moves[i + 1]) {
            row.appendChild(this.renderMoveButton(moves[i + 1]));
          } else {
            var empty = document.createElement("span");
            empty.className = "cw-move-empty";
            row.appendChild(empty);
          }
          list.appendChild(row);
        }
        return list;
      }.bind(this);

      var buildInterestingList = function (moves) {
        var list = document.createElement("div");
        list.className = "cw-move-list";
        moves.filter(function (m) { return interestingKinds[m.annotation]; }).forEach(function (m) {
          var row = document.createElement("div");
          row.className = "cw-move-row";
          var number = document.createElement("span");
          number.className = "cw-move-number";
          number.textContent = escapeText(m.move_number) + (m.color === "black" ? "..." : ".");
          row.appendChild(number);
          row.appendChild(this.renderMoveButton(m));
          var empty = document.createElement("span");
          empty.className = "cw-move-empty";
          row.appendChild(empty);
          list.appendChild(row);
        }, this);
        return list;
      }.bind(this);

      if (hasInteresting) {
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "cw-button cw-moves-toggle";
        toggle.textContent = "Key moves";
        toggle.addEventListener("click", function () {
          showAll = !showAll;
          toggle.textContent = showAll ? "Key moves" : "All moves";
          var old = section.querySelector(".cw-move-list");
          var next = showAll ? buildList(allMoves) : buildInterestingList(allMoves);
          old.replaceWith(next);
        });
        section.appendChild(toggle);
      }

      section.appendChild(buildList(allMoves));
      return section;
    }

    renderMoveButton(move) {
      var button = document.createElement("button");
      var kind = move.annotation || "good";
      button.type = "button";
      button.className =
        "cw-move" + (move.ply === this.currentPly ? " cw-active-move" : "");
      button.addEventListener("click", () => this.goTo(move.ply));

      var san = document.createElement("span");
      san.textContent = escapeText(move.san || "");
      var mark = document.createElement("span");
      mark.className = "cw-mark " + annotationClass(kind);
      mark.textContent = annotationMark(kind);

      button.appendChild(san);
      button.appendChild(mark);
      return button;
    }

    renderBookmarks(game) {
      var section = document.createElement("details");
      section.className = "cw-panel cw-bookmarks";
      section.setAttribute("data-panel", "bookmarks");
      if (this.panelOpen("bookmarks", true)) section.open = true;

      var title = document.createElement("summary");
      title.textContent = "Bookmarks";
      section.appendChild(title);

      var moves = this.bookmarkMoves(game);
      if (moves.length === 0) {
        var empty = document.createElement("p");
        empty.textContent = "No blunders or standout moves.";
        section.appendChild(empty);
        return section;
      }

      var list = document.createElement("ol");
      for (var i = 0; i < moves.length; i += 1) {
        var item = document.createElement("li");
        item.appendChild(this.renderBookmarkButton(moves[i]));
        list.appendChild(item);
      }

      section.appendChild(list);
      return section;
    }

    bookmarkMoves(game) {
      var important = {
        blunder: true,
        brilliant: true,
        great: true,
        great_move: true,
        greatmove: true,
        mistake: true,
        inaccuracy: true,
        checkmate: true,
      };
      var moves = Array.isArray(game && game.moves) ? game.moves : [];
      return moves.filter(function (move) {
        var kind = String(move.annotation || "")
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "");
        return important[kind];
      });
    }

    renderBookmarkButton(move) {
      var button = document.createElement("button");
      var kind = move.annotation || "good";
      button.type = "button";
      button.className =
        "cw-bookmark " +
        annotationClass(kind) +
        (move.ply === this.currentPly ? " cw-active-bookmark" : "");
      button.addEventListener("click", () => this.goTo(move.ply));

      var label = document.createElement("span");
      label.textContent =
        escapeText(move.move_number || "") +
        (move.color === "black" ? "... " : ". ") +
        escapeText(move.san || "");

      var mark = document.createElement("span");
      mark.className = "cw-mark " + annotationClass(kind);
      mark.textContent = annotationMark(kind);

      button.appendChild(label);
      button.appendChild(mark);
      return button;
    }
  }

  if (!customElements.get("chess-widget")) {
    customElements.define("chess-widget", ChessWidget);
  }
})();
