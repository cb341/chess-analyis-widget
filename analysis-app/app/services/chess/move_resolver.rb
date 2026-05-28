# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Resolves SAN notation into concrete source/destination board moves.
  class MoveResolver
    FILES = %w[a b c d e f g h].freeze
    SAN_PATTERN = /\A(?<piece>[KQRBN])?(?<disambiguation>[a-h1-8]{0,2})(?<capture>x)?(?<to>[a-h][1-8])(?:=(?<promotion>[QRBN]))?(?<check>[+#])?\z/

    def resolve(board, san)
      normalized = san.strip.gsub(/[!?]+$/, "")
      return resolve_castling(board, normalized, san) if /\AO-O(-O)?[+#]?\z/.match?(normalized)

      match = SAN_PATTERN.match(normalized)
      raise ArgumentError, "Cannot parse SAN #{san.inspect}" unless match

      piece_letter = match[:piece] || "P"
      color = board.current_color
      piece = (color == "white") ? piece_letter : piece_letter.downcase
      to = match[:to]
      candidates = candidate_sources(board, piece, to, match[:disambiguation], !!match[:capture])

      if candidates.empty?
        raise ArgumentError, "Cannot resolve #{san.inspect} for #{color} to #{to}"
      elsif candidates.length > 1
        raise ArgumentError, "Ambiguous SAN #{san.inspect}: #{candidates.join(", ")}"
      end

      from = candidates.first
      captured_square = captured_square_for(board, from, to, piece, !!match[:capture])
      captured = captured_square ? board.piece_at(captured_square) : nil

      {
        san: san,
        from: from,
        to: to,
        piece: piece_letter,
        captured: captured,
        captured_square: captured_square,
        promotion: match[:promotion],
        flags: flags(match, !!match[:capture], false)
      }
    end

    private

    def resolve_castling(board, normalized, original_san)
      color = board.current_color
      queenside = normalized.start_with?("O-O-O")
      from = (color == "white") ? "e1" : "e8"
      to = if color == "white"
        queenside ? "c1" : "g1"
      else
        queenside ? "c8" : "g8"
      end
      check = normalized.include?("+") || normalized.include?("#")
      {
        san: original_san,
        from: from,
        to: to,
        piece: "K",
        captured: nil,
        captured_square: nil,
        promotion: nil,
        flags: {
          "check" => check,
          "checkmate" => normalized.include?("#"),
          "capture" => false,
          "castling" => true,
          "promotion" => false
        }
      }
    end

    def candidate_sources(board, piece, to, disambiguation, capture)
      color = board.color_of(piece)
      board.squares.each_with_object([]) do |(from, board_piece), matches|
        next unless board_piece == piece
        next unless disambiguation_matches?(from, disambiguation)
        next unless can_move?(board, piece, from, to, capture)
        next if own_piece_on_target?(board, color, to)

        matches << from
      end
    end

    def disambiguation_matches?(from, disambiguation)
      return true if disambiguation.to_s.empty?

      disambiguation.each_char.all? { |part| from.include?(part) }
    end

    def can_move?(board, piece, from, to, capture)
      df = file(to) - file(from)
      dr = rank(to) - rank(from)
      target = board.piece_at(to)

      case piece.upcase
      when "P"
        pawn_move?(board, piece, from, to, df, dr, target, capture)
      when "N"
        [[1, 2], [2, 1]].include?([df.abs, dr.abs])
      when "B"
        df.abs == dr.abs && board.path_clear?(from, to)
      when "R"
        (df.zero? || dr.zero?) && board.path_clear?(from, to)
      when "Q"
        (df.abs == dr.abs || df.zero? || dr.zero?) && board.path_clear?(from, to)
      when "K"
        df.abs <= 1 && dr.abs <= 1
      else
        false
      end
    end

    def pawn_move?(board, piece, from, to, df, dr, target, capture)
      direction = (piece == piece.upcase) ? 1 : -1
      start_rank = (piece == piece.upcase) ? 2 : 7
      if capture
        return false unless df.abs == 1 && dr == direction

        target || board.en_passant == to
      elsif !target && df.zero? && dr == direction
        true
      elsif !target && df.zero? && dr == 2 * direction && rank(from) == start_rank
        intermediate = Chess::Board.square_name(file(from), rank(from) + direction)
        !board.piece_at(intermediate)
      else
        false
      end
    end

    def own_piece_on_target?(board, color, to)
      target = board.piece_at(to)
      target && board.color_of(target) == color
    end

    def captured_square_for(board, from, to, piece, capture)
      return nil unless capture
      return to if board.piece_at(to)

      if piece.upcase == "P" && board.en_passant == to
        direction = (piece == piece.upcase) ? -1 : 1
        return Chess::Board.square_name(file(to), rank(to) + direction)
      end

      nil
    end

    def flags(match, capture, castling)
      {
        "check" => match[:check] == "+" || match[:check] == "#",
        "checkmate" => match[:check] == "#",
        "capture" => capture,
        "castling" => castling,
        "promotion" => !!match[:promotion]
      }
    end

    def file(square)
      FILES.index(square[0])
    end

    def rank(square)
      square[1].to_i
    end
  end
end
