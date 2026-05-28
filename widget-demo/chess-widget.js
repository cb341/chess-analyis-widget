(function () {
  "use strict";

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
  var MARKS = {
    good: "!",
    mistake: "?",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#",
  };
  var BOARD_MARKERS = {
    good: "!",
    mistake: "?!",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#",
  };
  var SOUNDS = {
    move: "./assets/sounds/move.mp3",
    capture: "./assets/sounds/capture.mp3",
    check: "./assets/sounds/check.mp3",
    checkmate: "./assets/sounds/checkmate.mp3",
  };

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

  function moveLabel(game, ply) {
    if (!game || !Array.isArray(game.moves) || ply < 1)
      return "Starting position";
    var move = game.moves[ply - 1];
    if (!move) return "Position " + ply;
    var prefix = move.color === "black" ? "... " : ". ";
    return move.move_number + prefix + move.san;
  }

  class ChessWidget extends HTMLElement {
    constructor() {
      super();
      this.game = null;
      this.currentPly = 0;
      this._keyboardBound = false;
      this._focusBound = false;
      this._sounds = {};
    }

    connectedCallback() {
      if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
      this.setAttribute(
        "aria-keyshortcuts",
        "ArrowLeft ArrowRight ArrowUp ArrowDown Home End",
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

      try {
        this.load(JSON.parse(source.textContent || ""));
      } catch {
        this.renderError("Invalid chess data.");
      }
    }

    load(gameData) {
      this.game = gameData && typeof gameData === "object" ? gameData : null;
      this.currentPly = 0;

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
      this.currentPly = target;
      this.render();
      this.playSoundForPosition(this.game.positions[target]);
    }

    playSoundForPosition(position) {
      if (this.getAttribute("sound") === "off" || !position) return;
      var soundName = "move";
      var flags = position.flags || {};
      var lastMove = position.last_move || {};

      if (flags.checkmate) {
        soundName = "checkmate";
      } else if (flags.check) {
        soundName = "check";
      } else if (lastMove.capture || flags.capture) {
        soundName = "capture";
      }

      this.playSound(soundName);
    }

    playSound(name) {
      var source = SOUNDS[name];
      if (!source || typeof window.Audio !== "function") return;
      if (!this._sounds[name]) {
        this._sounds[name] = new window.Audio(source);
        this._sounds[name].preload = "auto";
      }

      var audio = this._sounds[name];
      audio.currentTime = 0;
      audio.play().catch(function () {
        // Browsers may block audio until the first trusted user gesture.
      });
    }

    next() {
      this.goTo(this.currentPly + 1);
    }

    previous() {
      this.goTo(this.currentPly - 1);
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
      var annotation = position.annotation || {};
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

      this.innerHTML = "";

      var shell = document.createElement("div");
      shell.className = "cw-shell";

      shell.appendChild(this.renderHeader(metadata));

      var main = document.createElement("div");
      main.className = "cw-main";

      var boardPanel = document.createElement("div");
      boardPanel.className = "cw-board-panel";
      boardPanel.appendChild(this.renderBoard(position));
      boardPanel.appendChild(this.renderAnnotation(annotation));
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
      title.textContent = "Live Chess";

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

      players.appendChild(white);
      players.appendChild(result);
      players.appendChild(black);
      header.appendChild(title);
      header.appendChild(players);
      return header;
    }

    renderBoard(position) {
      var wrap = document.createElement("div");
      var container = document.createElement("cg-container");
      var board = document.createElement("cg-board");
      var orientation =
        this.getAttribute("orientation") === "black" ? "black" : "white";
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var boardData =
        position && position.board && typeof position.board === "object"
          ? position.board
          : {};
      var lastMove = position && position.last_move ? position.last_move : {};

      wrap.className =
        "cg-wrap cgv1 orientation-" + orientation + " manipulable";
      board.className = "cw-board";
      board.setAttribute("role", "grid");
      board.setAttribute("aria-label", "Chess board");
      container.style.width = "100%";
      container.style.height = "100%";

      if (lastMove.from) {
        board.appendChild(this.renderBoardSquare(lastMove.from, "last-move"));
      }
      if (lastMove.to) {
        board.appendChild(this.renderBoardSquare(lastMove.to, "last-move"));
      }
      if (position && position.flags && position.flags.check && lastMove.to) {
        board.appendChild(this.renderBoardSquare(lastMove.to, "check"));
      }

      for (var r = 0; r < ranks.length; r += 1) {
        for (var f = 0; f < files.length; f += 1) {
          var squareName = files[f] + ranks[r];
          var piece = boardData[squareName];

          if (PIECE_IMAGES[piece]) {
            var marker = this.renderBoardMarker(position, squareName);
            if (marker) board.appendChild(marker);

            var pieceNode = document.createElement("piece");
            pieceNode.className =
              pieceClass(piece) +
              " cw-piece" +
              (lastMove.to === squareName ? " cw-piece-arrived" : "");
            pieceNode.style.setProperty(
              "--cw-transform",
              this.squareTransform(squareName),
            );
            pieceNode.style.transform = "var(--cw-transform)";
            pieceNode.setAttribute(
              "aria-label",
              squareName + ", " + pieceName(piece),
            );
            pieceNode.appendChild(this.renderPieceImage(piece));
            board.appendChild(pieceNode);
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
      var square = document.createElement("square");
      square.className = className;
      square.style.transform = this.squareTransform(squareName);
      square.setAttribute("aria-hidden", "true");
      return square;
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
      var annotation =
        position && position.annotation ? position.annotation : {};
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
      image.src = PIECE_IMAGE_PATH + PIECE_IMAGES[piece];
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
        <div class="cw-eval-wrap">
          <div
            class="cw-eval"
            aria-label="Evaluation: White ${whiteShare} percent, Black ${blackShare} percent"
          >
            <div class="cw-eval-black" style="height: ${blackShare}%"></div>
            <div class="cw-eval-white" style="height: ${whiteShare}%"></div>
          </div>
          <div class="cw-eval-text">White ${whiteShare}%</div>
        </div>
        <div data-slot="controls"></div>
        <section class="cw-current">
          <h2>${escapeHtml(moveLabel(game, this.currentPly))}</h2>
          <p>${escapeHtml((position.annotation && position.annotation.text) || "Starting position.")}</p>
        </section>
        <section class="cw-summary">
          <h2>Summary</h2>
          <p>${escapeHtml(game.summary || "")}</p>
        </section>
        <div data-slot="moves"></div>
      `;

      side
        .querySelector('[data-slot="controls"]')
        .replaceWith(this.renderControls(game));
      side
        .querySelector('[data-slot="moves"]')
        .replaceWith(this.renderMoveList(game));
      return side;
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

    renderMoveList(game) {
      var section = document.createElement("section");
      section.className = "cw-moves";

      var title = document.createElement("h2");
      title.textContent = "Moves";
      section.appendChild(title);

      var list = document.createElement("div");
      list.className = "cw-move-list";

      var moves = Array.isArray(game.moves) ? game.moves : [];
      for (var i = 0; i < moves.length; i += 2) {
        var row = document.createElement("div");
        row.className = "cw-move-row";

        var number = document.createElement("span");
        number.className = "cw-move-number";
        number.textContent =
          escapeText(moves[i].move_number || Math.floor(i / 2) + 1) + ".";
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

      section.appendChild(list);
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
  }

  if (!customElements.get("chess-widget")) {
    customElements.define("chess-widget", ChessWidget);
  }
})();
