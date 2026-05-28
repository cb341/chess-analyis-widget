# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Converts the current board state into a Stockfish-compatible FEN string.
  class FenBuilder
    FILES = %w[a b c d e f g h].freeze
    RANKS = [8, 7, 6, 5, 4, 3, 2, 1].freeze

    def build(board)
      [
        placement(board),
        (board.turn == "white") ? "w" : "b",
        castling(board),
        board.en_passant,
        board.halfmove_clock,
        board.fullmove_number
      ].join(" ")
    end

    private

    def placement(board)
      RANKS.map do |rank|
        empty = 0
        row = +""
        FILES.each do |file|
          piece = board.piece_at("#{file}#{rank}")
          if piece
            row << empty.to_s if empty.positive?
            empty = 0
            row << piece
          else
            empty += 1
          end
        end
        row << empty.to_s if empty.positive?
        row
      end.join("/")
    end

    def castling(board)
      value = +""
      value << "K" if board.castling["white_kingside"]
      value << "Q" if board.castling["white_queenside"]
      value << "k" if board.castling["black_kingside"]
      value << "q" if board.castling["black_queenside"]
      value.empty? ? "-" : value
    end
  end
end
