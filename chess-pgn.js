(function () {
  "use strict";

  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

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

  window.ChessPgn = {
    parse: parsePgn,
  };
}());
