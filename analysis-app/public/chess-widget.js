(function () {
  var PIECES = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
  };
  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  var LABELS = {
    good: "Good move",
    mistake: "Mistake",
    blunder: "Blunder",
    brilliant: "Brilliant",
    checkmate: "Checkmate"
  };
  var MARKS = {
    good: "",
    mistake: "?",
    blunder: "??",
    brilliant: "!!",
    checkmate: "#"
  };

  class ChessWidget extends HTMLElement {
    connectedCallback() {
      this.currentPly = 0;
      this.setAttribute("tabindex", "0");
      this.addEventListener("keydown", this.onKeyDown.bind(this));
      this.loadFromSource();
    }

    loadFromSource() {
      var sourceId = this.getAttribute("data-source");
      var source = sourceId && document.getElementById(sourceId);
      if (!source) return this.renderError("Unable to load chess data.");
      try {
        this.load(JSON.parse(source.textContent));
      } catch (error) {
        this.renderError("Invalid chess data.");
      }
    }

    load(gameData) {
      if (!gameData || !gameData.positions || !gameData.positions.length) {
        return this.renderError("No chess positions available.");
      }
      this.game = gameData;
      this.currentPly = 0;
      this.render();
    }

    goTo(ply) {
      if (!this.game) return;
      this.currentPly = Math.max(0, Math.min(ply, this.game.positions.length - 1));
      this.render();
    }

    next() { this.goTo(this.currentPly + 1); }
    previous() { this.goTo(this.currentPly - 1); }
    start() { this.goTo(0); }
    end() { this.goTo(this.game.positions.length - 1); }

    onKeyDown(event) {
      if (event.key === "ArrowLeft") this.previous();
      if (event.key === "ArrowRight") this.next();
      if (event.key === "Home") this.start();
      if (event.key === "End") this.end();
    }

    render() {
      var position = this.game.positions[this.currentPly];
      this.innerHTML = [
        "<section class=\"cw-shell\">",
        "<div class=\"cw-stage\">", this.renderEval(position), this.renderBoard(position), "</div>",
        "<aside class=\"cw-side\">", this.renderHeader(), this.renderControls(), this.renderCurrent(position), this.renderMoves(), "</aside>",
        "</section>"
      ].join("");
      this.bindButtons();
    }

    renderHeader() {
      var metadata = this.game.metadata || {};
      return "<h2>" + escapeHtml(metadata.White || "White") + " vs " + escapeHtml(metadata.Black || "Black") + "</h2>" +
        "<p>" + escapeHtml(metadata.Result || "*") + "</p>" +
        "<p>" + escapeHtml(this.game.summary || "") + "</p>";
    }

    renderControls() {
      return "<div class=\"cw-controls\">" +
        "<button type=\"button\" data-action=\"previous\"" + (this.currentPly === 0 ? " disabled" : "") + ">Previous</button>" +
        "<button type=\"button\" data-action=\"next\"" + (this.currentPly >= this.game.positions.length - 1 ? " disabled" : "") + ">Next</button>" +
        "</div>";
    }

    renderCurrent(position) {
      var annotation = position.annotation ? LABELS[position.annotation] || position.annotation : "";
      return "<div class=\"cw-current\" aria-live=\"polite\">" + (position.san ? escapeHtml(position.san) : "Starting position") + "</div>" +
        "<div class=\"cw-annotation cw-annotation-" + escapeHtml(position.annotation || "none") + "\">" + escapeHtml(annotation) + "</div>";
    }

    renderEval(position) {
      var bar = position.eval_bar || { white: 50, black: 50 };
      var white = Math.max(0, Math.min(100, Number(bar.white) || 50));
      return "<div class=\"cw-eval\" aria-label=\"Evaluation\">" +
        "<div class=\"cw-eval-black\" style=\"height:" + (100 - white) + "%\"></div>" +
        "<div class=\"cw-eval-white\" style=\"height:" + white + "%\"></div>" +
        "</div>";
    }

    renderBoard(position) {
      var html = ["<div class=\"cw-board\">"];
      for (var rank = 8; rank >= 1; rank--) {
        for (var file = 0; file < FILES.length; file++) {
          var square = FILES[file] + rank;
          var piece = position.board[square] || "";
          var isLight = (file + rank) % 2 === 1;
          var last = position.last_move && (position.last_move.from === square || position.last_move.to === square);
          html.push("<div class=\"cw-square " + (isLight ? "cw-light" : "cw-dark") + (last ? " cw-last" : "") + "\" aria-label=\"" + square + "\">" + (PIECES[piece] || "") + "</div>");
        }
      }
      html.push("</div>");
      return html.join("");
    }

    renderMoves() {
      var rows = ["<div class=\"cw-moves\">"];
      for (var index = 0; index < this.game.moves.length; index += 2) {
        var white = this.game.moves[index];
        var black = this.game.moves[index + 1];
        rows.push("<span>" + white.move_number + ".</span>");
        rows.push(this.moveButton(white));
        rows.push(black ? this.moveButton(black) : "<span></span>");
      }
      rows.push("</div>");
      return rows.join("");
    }

    moveButton(move) {
      return "<button type=\"button\" data-ply=\"" + move.ply + "\" aria-current=\"" + (move.ply === this.currentPly ? "true" : "false") + "\">" +
        escapeHtml(move.san + (MARKS[move.annotation] || "")) + "</button>";
    }

    bindButtons() {
      var self = this;
      this.querySelectorAll("[data-action]").forEach(function (button) {
        button.addEventListener("click", function () { self[button.dataset.action](); });
      });
      this.querySelectorAll("[data-ply]").forEach(function (button) {
        button.addEventListener("click", function () { self.goTo(Number(button.dataset.ply)); });
      });
    }

    renderError(message) {
      this.innerHTML = "<p>" + escapeHtml(message) + "</p>";
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  customElements.define("chess-widget", ChessWidget);
})();
