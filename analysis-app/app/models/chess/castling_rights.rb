# frozen_string_literal: true

require_relative "model_support"

module Chess
  # Declares castling availability and knows how to serialize it for FEN.
  class CastlingRights
    include ModelSupport

    attr_accessor :white_kingside, :white_queenside, :black_kingside, :black_queenside

    def self.from_board(board)
      new(
        white_kingside: board.castling["white_kingside"],
        white_queenside: board.castling["white_queenside"],
        black_kingside: board.castling["black_kingside"],
        black_queenside: board.castling["black_queenside"]
      )
    end

    def fen
      rights = [
        white_kingside ? "K" : nil,
        white_queenside ? "Q" : nil,
        black_kingside ? "k" : nil,
        black_queenside ? "q" : nil
      ].compact.join

      rights.empty? ? "-" : rights
    end
  end
end
