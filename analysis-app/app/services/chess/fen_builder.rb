# frozen_string_literal: true

require_relative "../../models/chess/fen_position"

module Chess
  # Serializes Board state into the FEN format Stockfish expects.
  class FenBuilder
    def build(board)
      FenPosition.from_board(board).to_s
    end
  end
end
