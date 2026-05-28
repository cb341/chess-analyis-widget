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
  };
  var SCRIPT_URL =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : document.baseURI;
  var ASSET_BASE_URL = new URL(".", SCRIPT_URL);

  function assetUrl(path) {
    return new URL(path, ASSET_BASE_URL).toString();
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

  function cloneBoard(board) {
    var copy = {};
    Object.keys(board).forEach(function (square) {
      copy[square] = board[square];
    });
    return copy;
  }

  function startingBoard() {
    var board = {};
    var back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
    FILES.forEach(function (file, index) {
      board[file + "1"] = back[index];
      board[file + "2"] = "P";
      board[file + "7"] = "p";
      board[file + "8"] = back[index].toLowerCase();
    });
    return board;
  }

  function boardFromFen(fen) {
    var placement = (fen || "").split(/\s+/)[0];
    var board = {};
    var rank = 8;
    var file = 0;
    for (var i = 0; i < placement.length; i += 1) {
      var ch = placement[i];
      if (ch === "/") {
        rank -= 1;
        file = 0;
      } else if (/[1-8]/.test(ch)) {
        file += Number(ch);
      } else {
        board[FILES[file] + rank] = ch;
        file += 1;
      }
    }
    return board;
  }

  function boardToFen(board, turn, castling, enPassant, halfmove, fullmove) {
    var rows = [];
    for (var rank = 8; rank >= 1; rank -= 1) {
      var row = "";
      var empty = 0;
      FILES.forEach(function (file) {
        var piece = board[file + rank];
        if (piece) {
          if (empty) row += String(empty);
          empty = 0;
          row += piece;
        } else {
          empty += 1;
        }
      });
      if (empty) row += String(empty);
      rows.push(row);
    }
    return [
      rows.join("/"),
      turn === "white" ? "w" : "b",
      castlingFen(castling),
      enPassant || "-",
      halfmove,
      fullmove,
    ].join(" ");
  }

  function castlingFen(castling) {
    var value = "";
    if (castling.white_kingside) value += "K";
    if (castling.white_queenside) value += "Q";
    if (castling.black_kingside) value += "k";
    if (castling.black_queenside) value += "q";
    return value || "-";
  }

  function colorOf(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? "white" : "black";
  }

  function fileIndex(square) {
    return FILES.indexOf(square[0]);
  }

  function rankNumber(square) {
    return Number(square[1]);
  }

  function squareName(file, rank) {
    return FILES[file] + rank;
  }

  function pathClear(board, from, to) {
    var fileStep = Math.sign(fileIndex(to) - fileIndex(from));
    var rankStep = Math.sign(rankNumber(to) - rankNumber(from));
    var file = fileIndex(from) + fileStep;
    var rank = rankNumber(from) + rankStep;
    while (file !== fileIndex(to) || rank !== rankNumber(to)) {
      if (board[squareName(file, rank)]) return false;
      file += fileStep;
      rank += rankStep;
    }
    return true;
  }

  function parseFenState(fen) {
    var parts = (fen || "").trim().split(/\s+/);
    var rights = parts[2] || "-";
    return {
      board: boardFromFen(fen),
      turn: parts[1] === "b" ? "black" : "white",
      castling: {
        white_kingside: rights.indexOf("K") !== -1,
        white_queenside: rights.indexOf("Q") !== -1,
        black_kingside: rights.indexOf("k") !== -1,
        black_queenside: rights.indexOf("q") !== -1,
      },
      enPassant: parts[3] || "-",
      halfmove: Number(parts[4] || 0),
      fullmove: Number(parts[5] || 1),
    };
  }

  function initialState(metadata) {
    if (metadata.SetUp === "1" && metadata.FEN) return parseFenState(metadata.FEN);
    return {
      board: startingBoard(),
      turn: "white",
      castling: {
        white_kingside: true,
        white_queenside: true,
        black_kingside: true,
        black_queenside: true,
      },
      enPassant: "-",
      halfmove: 0,
      fullmove: 1,
    };
  }

  function parsePgn(pgn) {
    if (!pgn || !pgn.trim()) throw new Error("PGN is blank.");
    var metadata = {};
    var body = [];
    pgn.split(/\r?\n/).forEach(function (line) {
      var match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
      if (match) {
        metadata[match[1]] = match[2].replace(/\\"/g, '"');
      } else {
        body.push(line);
      }
    });
    var tokens = tokenizeMovetext(body.join("\n"));
    var state = initialState(metadata);
    var positions = [
      {
        ply: 0,
        board: cloneBoard(state.board),
        fen: boardToFen(
          state.board,
          state.turn,
          state.castling,
          state.enPassant,
          state.halfmove,
          state.fullmove,
        ),
      },
    ];
    var moves = [];
    tokens.forEach(function (token, index) {
      var move = resolveMove(state, token.san);
      applyMove(state, move);
      var ply = index + 1;
      var color = move.color;
      var moveNumber =
        color === "white" ? state.fullmove : Math.max(1, state.fullmove - 1);
      var parsed = parseComment(token.comment || "");
      var glyph = token.glyph || parsed.glyph || "";
      var moveRecord = {
        ply: ply,
        index: index,
        san: token.san,
        side: color,
        color: color,
        move_number: moveNumber,
        comment: parsed.text,
        eval: parsed.eval,
        clock: parsed.clock,
        glyph: glyph,
        annotation: glyph,
      };
      moves.push(moveRecord);
      positions.push({
        ply: ply,
        board: cloneBoard(state.board),
        fen: boardToFen(
          state.board,
          state.turn,
          state.castling,
          state.enPassant,
          state.halfmove,
          state.fullmove,
        ),
        last_move: move,
        flags: move.flags,
        pgn_comment: parsed.text,
        comment: parsed.text,
        eval: parsed.eval,
        clock: parsed.clock,
        glyph: glyph,
      });
    });
    if (moves.length === 0) throw new Error("PGN does not contain moves.");
    return { metadata: metadata, moves: moves, positions: positions, raw: pgn };
  }

  function tokenizeMovetext(text) {
    var tokens = [];
    var index = 0;
    var pending = null;
    text = text.replace(/;[^\n\r]*/g, " ");
    while (index < text.length) {
      var char = text[index];
      if (/\s/.test(char)) {
        index += 1;
      } else if (char === "{") {
        var end = text.indexOf("}", index + 1);
        if (end === -1) end = text.length - 1;
        var comment = text.slice(index + 1, end).trim();
        if (tokens.length) tokens[tokens.length - 1].comment = comment;
        else pending = comment;
        index = end + 1;
      } else if (char === "(") {
        index = skipVariation(text, index + 1);
      } else {
        var next = index;
        while (next < text.length && !/\s/.test(text[next]) && text[next] !== "{") {
          next += 1;
        }
        var raw = text.slice(index, next);
        index = next;
        if (/^\d+\.(\.\.)?$/.test(raw) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(raw)) {
          continue;
        }
        if (/^\$\d+$/.test(raw)) {
          if (tokens.length) tokens[tokens.length - 1].glyph = nagGlyph(raw);
          continue;
        }
        var glyphMatch = raw.match(/(!!|\?\?|!\?|\?!|!|\?)$/);
        var san = raw.replace(/(!!|\?\?|!\?|\?!|!|\?)+$/, "");
        tokens.push({ san: san, comment: pending, glyph: glyphMatch ? glyphMatch[1] : "" });
        pending = null;
      }
    }
    return tokens;
  }

  function skipVariation(text, index) {
    var depth = 1;
    while (index < text.length && depth > 0) {
      if (text[index] === "(") depth += 1;
      if (text[index] === ")") depth -= 1;
      index += 1;
    }
    return index;
  }

  function nagGlyph(raw) {
    return { $1: "!", $2: "?", $3: "!!", $4: "??", $5: "!?", $6: "?!" }[raw] || "";
  }

  function parseComment(comment) {
    var evalValue = null;
    var clock = null;
    var text = (comment || "")
      .replace(/\[%eval\s+([^\]]+)\]/g, function (_, value) {
        evalValue = parseEval(value.trim());
        return " ";
      })
      .replace(/\[%clk\s+([^\]]+)\]/g, function (_, value) {
        clock = value.trim();
        return " ";
      })
      .replace(/\s+/g, " ")
      .trim();
    return { text: text, eval: evalValue, clock: clock };
  }

  function parseEval(value) {
    if (/^#-?\d+$/.test(value)) {
      return { value: Number(value.slice(1)), mate: true };
    }
    var number = Number(value);
    if (Number.isFinite(number)) return { value: number, mate: false };
    return null;
  }

  function resolveMove(state, san) {
    var normalized = san.trim().replace(/(!!|\?\?|!\?|\?!|!|\?)+$/, "");
    if (/^O-O(-O)?[+#]?$/.test(normalized)) {
      return resolveCastling(state, normalized, san);
    }
    var match = normalized.match(/^([KQRBN])?([a-h1-8]{0,2})(x)?([a-h][1-8])(?:=([QRBN]))?([+#])?$/);
    if (!match) throw new Error("Cannot parse SAN " + san);
    var pieceLetter = match[1] || "P";
    var color = state.turn;
    var piece = color === "white" ? pieceLetter : pieceLetter.toLowerCase();
    var to = match[4];
    var candidates = candidateSources(state, piece, to, match[2], !!match[3]);
    if (candidates.length !== 1) throw new Error("Cannot resolve SAN " + san);
    var from = candidates[0];
    var capturedSquare = capturedSquareFor(state, from, to, piece, !!match[3]);
    return {
      san: san,
      from: from,
      to: to,
      piece: pieceLetter,
      color: color,
      captured: capturedSquare ? state.board[capturedSquare] || null : null,
      captured_square: capturedSquare,
      promotion: match[5] || null,
      flags: {
        check: match[6] === "+" || match[6] === "#",
        checkmate: match[6] === "#",
        capture: !!match[3],
        castling: false,
        promotion: !!match[5],
      },
    };
  }

  function resolveCastling(state, normalized, san) {
    var color = state.turn;
    var queenside = normalized.indexOf("O-O-O") === 0;
    var rank = color === "white" ? "1" : "8";
    return {
      san: san,
      from: "e" + rank,
      to: (queenside ? "c" : "g") + rank,
      piece: "K",
      color: color,
      captured: null,
      captured_square: null,
      promotion: null,
      flags: {
        check: normalized.indexOf("+") !== -1 || normalized.indexOf("#") !== -1,
        checkmate: normalized.indexOf("#") !== -1,
        capture: false,
        castling: true,
        promotion: false,
      },
    };
  }

  function candidateSources(state, piece, to, disambiguation, capture) {
    var color = colorOf(piece);
    return Object.keys(state.board).filter(function (from) {
      return (
        state.board[from] === piece &&
        disambiguationMatches(from, disambiguation) &&
        canMove(state, piece, from, to, capture) &&
        colorOf(state.board[to]) !== color
      );
    });
  }

  function disambiguationMatches(from, disambiguation) {
    return !disambiguation || disambiguation.split("").every(function (part) {
      return from.indexOf(part) !== -1;
    });
  }

  function canMove(state, piece, from, to, capture) {
    var df = fileIndex(to) - fileIndex(from);
    var dr = rankNumber(to) - rankNumber(from);
    var target = state.board[to];
    switch (piece.toUpperCase()) {
      case "P":
        return pawnMove(state, piece, from, to, df, dr, target, capture);
      case "N":
        return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
      case "B":
        return Math.abs(df) === Math.abs(dr) && pathClear(state.board, from, to);
      case "R":
        return (df === 0 || dr === 0) && pathClear(state.board, from, to);
      case "Q":
        return (Math.abs(df) === Math.abs(dr) || df === 0 || dr === 0) && pathClear(state.board, from, to);
      case "K":
        return Math.abs(df) <= 1 && Math.abs(dr) <= 1;
      default:
        return false;
    }
  }

  function pawnMove(state, piece, from, to, df, dr, target, capture) {
    var direction = piece === piece.toUpperCase() ? 1 : -1;
    var startRank = piece === piece.toUpperCase() ? 2 : 7;
    if (capture) return Math.abs(df) === 1 && dr === direction && (target || state.enPassant === to);
    if (!target && df === 0 && dr === direction) return true;
    if (!target && df === 0 && dr === 2 * direction && rankNumber(from) === startRank) {
      return !state.board[squareName(fileIndex(from), rankNumber(from) + direction)];
    }
    return false;
  }

  function capturedSquareFor(state, from, to, piece, capture) {
    if (!capture) return null;
    if (state.board[to]) return to;
    if (piece.toUpperCase() === "P" && state.enPassant === to) {
      var direction = piece === piece.toUpperCase() ? -1 : 1;
      return squareName(fileIndex(to), rankNumber(to) + direction);
    }
    return null;
  }

  function applyMove(state, move) {
    var piece = state.board[move.from];
    if (!piece) throw new Error("No piece on " + move.from);
    delete state.board[move.from];
    if (move.captured_square) delete state.board[move.captured_square];
    delete state.board[move.to];
    if (move.flags.castling) applyCastlingRook(state, move);
    state.board[move.to] =
      move.promotion && colorOf(piece) === "white"
        ? move.promotion
        : move.promotion
          ? move.promotion.toLowerCase()
          : piece;
    updateCastlingRights(state, piece, move);
    state.halfmove = piece.toUpperCase() === "P" || move.captured ? 0 : state.halfmove + 1;
    state.enPassant = enPassantTarget(piece, move);
    if (state.turn === "black") {
      state.fullmove += 1;
      state.turn = "white";
    } else {
      state.turn = "black";
    }
  }

  function applyCastlingRook(state, move) {
    var rank = move.to[1];
    if (move.to[0] === "g") state.board["f" + rank] = state.board["h" + rank];
    if (move.to[0] === "c") state.board["d" + rank] = state.board["a" + rank];
    if (move.to[0] === "g") delete state.board["h" + rank];
    if (move.to[0] === "c") delete state.board["a" + rank];
  }

  function updateCastlingRights(state, piece, move) {
    var color = colorOf(piece);
    if (piece.toUpperCase() === "K") {
      state.castling[color + "_kingside"] = false;
      state.castling[color + "_queenside"] = false;
    }
    if (piece.toUpperCase() === "R") {
      if (move.from === "h1") state.castling.white_kingside = false;
      if (move.from === "a1") state.castling.white_queenside = false;
      if (move.from === "h8") state.castling.black_kingside = false;
      if (move.from === "a8") state.castling.black_queenside = false;
    }
    if (move.to === "h1") state.castling.white_kingside = false;
    if (move.to === "a1") state.castling.white_queenside = false;
    if (move.to === "h8") state.castling.black_kingside = false;
    if (move.to === "a8") state.castling.black_queenside = false;
  }

  function enPassantTarget(piece, move) {
    if (piece.toUpperCase() !== "P") return "-";
    if (Math.abs(rankNumber(move.from) - rankNumber(move.to)) !== 2) return "-";
    return squareName(fileIndex(move.from), (rankNumber(move.from) + rankNumber(move.to)) / 2);
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
      return parsePgn(pgn);
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
      this.classList.add("cw-widget");
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
        this.game = parsePgn(pgn);
        this.currentPly = this.resolveInitialPly();
        this.emitWidgetEvent("load", {
          game: this.game,
          ply: this.currentPly,
          source: this.hasAttribute("src") ? this.getAttribute("src") : "inline",
        });
        this.render();
      } catch (error) {
        this.emitWidgetEvent("error", { error: error });
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
      var flags = position.flags || {};
      var name = flags.checkmate ? "checkmate" : flags.capture ? "capture" : flags.check ? "check" : flags.castling ? "castle" : "move";
      var audio = new window.Audio(assetUrl(SOUNDS[name]));
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
      values.forEach(function (value, index) {
        var coord = document.createElement("coord");
        coord.className = index % 2 === 0 ? "coord-dark" : "coord-light";
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
      box.className = "cw-annotation";
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
      prev.textContent = this.controlLabel("previous");
      prev.title = "Previous move. Keyboard: ArrowLeft or ArrowUp.";
      prev.disabled = this.currentPly <= this.startPly();
      prev.addEventListener("click", () => this.previous());
      var counter = document.createElement("div");
      counter.className = "cw-counter";
      counter.title = "Moves " + this.startPly() + "-" + this.endPly() + ". Keyboard: Home and End jump to the bounds.";
      counter.textContent = this.currentPly + " / " + this.endPly();
      var next = document.createElement("button");
      next.type = "button";
      next.className = "cw-button";
      next.textContent = this.controlLabel("next");
      next.title = "Next move. Keyboard: ArrowRight or ArrowDown.";
      next.disabled = this.currentPly >= this.endPly();
      next.addEventListener("click", () => this.next());
      controls.appendChild(prev);
      controls.appendChild(counter);
      controls.appendChild(next);
      return controls;
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
