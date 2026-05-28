# frozen_string_literal: true

module Chess
  # Converts a FEN string to various text/board representations.
  module BoardPresenter
    PIECES = {
      "K" => "♔", "Q" => "♕", "R" => "♖", "B" => "♗", "N" => "♘", "P" => "♙",
      "k" => "♚", "q" => "♛", "r" => "♜", "b" => "♝", "n" => "♞", "p" => "♟"
    }.freeze
    FILES = %w[a b c d e f g h].freeze
    RANKS = [8, 7, 6, 5, 4, 3, 2, 1].freeze

    def self.stringify_keys(hash)
      hash.each_with_object({}) { |(k, v), h| h[k.to_s] = v }
    end

    def self.fen_to_square_map(fen)
      board = {}
      rank = 8
      file = 0
      fen.to_s.split(" ")[0].to_s.each_char do |ch|
        if ch == "/"
          rank -= 1
          file = 0
        elsif ch =~ /[1-8]/
          file += ch.to_i
        else
          board["#{FILES[file]}#{rank}"] = ch
          file += 1
        end
      end
      board
    end

    def self.board_text(fen, fallback_map: nil)
      board = fen.to_s.empty? ? stringify_keys(fallback_map || {}) : fen_to_square_map(fen)
      rows = ["  a b c d e f g h"]
      RANKS.each do |rank|
        rows << "#{rank} #{FILES.map { |f| PIECES.fetch(board.fetch("#{f}#{rank}", ""), "·") }.join(" ")} #{rank}"
      end
      rows << "  a b c d e f g h"
      rows.join("\n")
    end
  end
end
