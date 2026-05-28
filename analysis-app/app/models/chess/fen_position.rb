# frozen_string_literal: true

require_relative "model_support"
require_relative "castling_rights"

module Chess
  # Concrete FEN resource assembled from board state.
  class FenPosition
    include ModelSupport

    FILES = %w[a b c d e f g h].freeze
    RANKS = [8, 7, 6, 5, 4, 3, 2, 1].freeze

    attr_accessor :piece_placement,
      :active_color,
      :castling_availability,
      :en_passant_target,
      :halfmove_clock,
      :fullmove_number

    def self.from_board(board)
      new(
        piece_placement: placement_for(board),
        active_color: (board.turn == "white") ? "w" : "b",
        castling_availability: CastlingRights.from_board(board).fen,
        en_passant_target: board.en_passant,
        halfmove_clock: board.halfmove_clock,
        fullmove_number: board.fullmove_number
      )
    end

    def to_s
      [
        piece_placement,
        active_color,
        castling_availability,
        en_passant_target,
        halfmove_clock,
        fullmove_number
      ].join(" ")
    end

    def to_h
      {
        piece_placement: piece_placement,
        active_color: active_color,
        castling_availability: castling_availability,
        en_passant_target: en_passant_target,
        halfmove_clock: halfmove_clock,
        fullmove_number: fullmove_number
      }
    end

    def self.placement_for(board)
      RANKS.map { |rank| rank_placement(board, rank) }.join("/")
    end

    def self.rank_placement(board, rank)
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
    end

    private_class_method :placement_for, :rank_placement
  end
end
