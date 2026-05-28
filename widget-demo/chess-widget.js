(function () {
  "use strict";

  var PIECES = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };

  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  var RANKS_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
  var RANKS_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];
  var MARKS = {
    mistake: "?",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#",
  };

  function clampPercent(value, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
  }

  function escapeText(value) {
    return String(value == null ? "" : value);
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
    }

    connectedCallback() {
      if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");
      this.classList.add("cw-widget");
      this.bindKeyboard();
      this.loadFromSource();
    }

    bindKeyboard() {
      if (this._keyboardBound) return;
      this._keyboardBound = true;
      this.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          this.previous();
        } else if (event.key === "ArrowRight") {
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
      this.currentPly = target;
      this.render();
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
      var board = document.createElement("div");
      var orientation =
        this.getAttribute("orientation") === "black" ? "black" : "white";
      var ranks = orientation === "black" ? RANKS_BLACK : RANKS_WHITE;
      var files = orientation === "black" ? FILES.slice().reverse() : FILES;
      var boardData =
        position && position.board && typeof position.board === "object"
          ? position.board
          : {};
      var lastMove = position && position.last_move ? position.last_move : {};

      board.className = "cw-board";
      board.setAttribute("role", "grid");
      board.setAttribute("aria-label", "Chess board");

      for (var r = 0; r < ranks.length; r += 1) {
        for (var f = 0; f < files.length; f += 1) {
          var squareName = files[f] + ranks[r];
          var square = document.createElement("div");
          var fileIndex = FILES.indexOf(files[f]);
          var rankNumber = Number(ranks[r]);
          var light = (fileIndex + rankNumber) % 2 === 1;
          var piece = boardData[squareName];

          square.className = "cw-square " + (light ? "cw-light" : "cw-dark");
          if (lastMove.from === squareName || lastMove.to === squareName) {
            square.className += " cw-last-move";
          }
          if (lastMove.to === squareName) {
            square.className += " cw-destination";
          }
          square.setAttribute("role", "gridcell");
          square.setAttribute(
            "aria-label",
            piece
              ? squareName + ", " + pieceName(piece)
              : squareName + ", empty",
          );

          var coord = document.createElement("span");
          coord.className = "cw-coordinate";
          coord.textContent = squareName;
          square.appendChild(coord);

          if (PIECES[piece]) {
            var pieceNode = document.createElement("span");
            pieceNode.className = "cw-piece";
            pieceNode.setAttribute("aria-hidden", "true");
            pieceNode.textContent = PIECES[piece];
            square.appendChild(pieceNode);
          }

          board.appendChild(square);
        }
      }

      return board;
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

      var evalWrap = document.createElement("div");
      evalWrap.className = "cw-eval-wrap";

      var evalBar = document.createElement("div");
      evalBar.className = "cw-eval";
      evalBar.setAttribute(
        "aria-label",
        "Evaluation: White " +
          whiteShare +
          " percent, Black " +
          blackShare +
          " percent",
      );

      var black = document.createElement("div");
      black.className = "cw-eval-black";
      black.style.height = blackShare + "%";
      var white = document.createElement("div");
      white.className = "cw-eval-white";
      white.style.height = whiteShare + "%";

      evalBar.appendChild(black);
      evalBar.appendChild(white);
      evalWrap.appendChild(evalBar);

      var evalText = document.createElement("div");
      evalText.className = "cw-eval-text";
      evalText.textContent = "White " + whiteShare + "%";
      evalWrap.appendChild(evalText);
      side.appendChild(evalWrap);

      side.appendChild(this.renderControls(game));

      var current = document.createElement("section");
      current.className = "cw-current";
      var currentTitle = document.createElement("h2");
      currentTitle.textContent = moveLabel(game, this.currentPly);
      var currentText = document.createElement("p");
      currentText.textContent = escapeText(
        (position.annotation && position.annotation.text) ||
          "Starting position.",
      );
      current.appendChild(currentTitle);
      current.appendChild(currentText);
      side.appendChild(current);

      var summary = document.createElement("section");
      summary.className = "cw-summary";
      var summaryTitle = document.createElement("h2");
      summaryTitle.textContent = "Summary";
      var summaryText = document.createElement("p");
      summaryText.textContent = escapeText(game.summary || "");
      summary.appendChild(summaryTitle);
      summary.appendChild(summaryText);
      side.appendChild(summary);

      side.appendChild(this.renderMoveList(game));
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
