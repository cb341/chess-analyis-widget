# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Mutable board state used to replay resolved SAN moves and produce snapshots.
  class Board
    FILES = %w[a b c d e f g h].freeze
    RANKS = %w[1 2 3 4 5 6 7 8].freeze
    STARTING_BACK_RANK = %w[R N B Q K B N R].freeze

    attr_reader :squares, :turn, :castling, :en_passant, :halfmove_clock, :fullmove_number

    def initialize
      @squares = starting_squares
      @turn = "white"
      @castling = {
        "white_kingside" => true,
        "white_queenside" => true,
        "black_kingside" => true,
        "black_queenside" => true
      }
      @en_passant = "-"
      @halfmove_clock = 0
      @fullmove_number = 1
    end

    def dup
      copy = self.class.allocate
      copy.instance_variable_set(:@squares, @squares.dup)
      copy.instance_variable_set(:@turn, @turn.dup)
      copy.instance_variable_set(:@castling, @castling.dup)
      copy.instance_variable_set(:@en_passant, @en_passant.dup)
      copy.instance_variable_set(:@halfmove_clock, @halfmove_clock)
      copy.instance_variable_set(:@fullmove_number, @fullmove_number)
      copy
    end

    def snapshot
      @squares.sort.to_h
    end

    def piece_at(square)
      @squares[square]
    end

    def color_of(piece)
      return nil unless piece

      piece == piece.upcase ? "white" : "black"
    end

    def current_color
      @turn
    end

    def enemy_color
      @turn == "white" ? "black" : "white"
    end

    def apply_move(move)
      piece = @squares.delete(move[:from])
      raise ArgumentError, "No piece on #{move[:from]}" unless piece

      captured = move[:captured]
      @squares.delete(move[:captured_square]) if move[:captured_square]
      @squares.delete(move[:to])

      if move[:flags]["castling"]
        apply_castling_rook(move)
      end

      placed_piece = promotion_piece(piece, move[:promotion])
      @squares[move[:to]] = placed_piece
      update_castling_rights(piece, move)
      update_clocks(piece, captured, move)
      switch_turn
      move.merge(captured: captured)
    end

    def path_clear?(from, to)
      file_step = to_file(to) <=> to_file(from)
      rank_step = to_rank(to) <=> to_rank(from)
      file = to_file(from) + file_step
      rank = to_rank(from) + rank_step

      while file != to_file(to) || rank != to_rank(to)
        return false if @squares[square_name(file, rank)]

        file += file_step
        rank += rank_step
      end

      true
    end

    def self.square_name(file_index, rank)
      "#{FILES[file_index]}#{rank}"
    end

    def self.file_index(square)
      FILES.index(square[0])
    end

    def self.rank(square)
      square[1].to_i
    end

    private

    def starting_squares
      squares = {}
      FILES.each_with_index do |file, index|
        squares["#{file}1"] = STARTING_BACK_RANK[index]
        squares["#{file}2"] = "P"
        squares["#{file}7"] = "p"
        squares["#{file}8"] = STARTING_BACK_RANK[index].downcase
      end
      squares
    end

    def apply_castling_rook(move)
      case [@turn, move[:to]]
      when ["white", "g1"]
        @squares["f1"] = @squares.delete("h1")
      when ["white", "c1"]
        @squares["d1"] = @squares.delete("a1")
      when ["black", "g8"]
        @squares["f8"] = @squares.delete("h8")
      when ["black", "c8"]
        @squares["d8"] = @squares.delete("a8")
      end
    end

    def promotion_piece(piece, promotion)
      return piece unless promotion

      color_of(piece) == "white" ? promotion : promotion.downcase
    end

    def update_castling_rights(piece, move)
      color = color_of(piece)
      if piece.upcase == "K"
        @castling["#{color}_kingside"] = false
        @castling["#{color}_queenside"] = false
      elsif piece.upcase == "R"
        if move[:from] == "h1"
          @castling["white_kingside"] = false
        elsif move[:from] == "a1"
          @castling["white_queenside"] = false
        elsif move[:from] == "h8"
          @castling["black_kingside"] = false
        elsif move[:from] == "a8"
          @castling["black_queenside"] = false
        end
      end

      case move[:to]
      when "h1" then @castling["white_kingside"] = false
      when "a1" then @castling["white_queenside"] = false
      when "h8" then @castling["black_kingside"] = false
      when "a8" then @castling["black_queenside"] = false
      end
    end

    def update_clocks(piece, captured, move)
      @halfmove_clock = piece.upcase == "P" || captured ? 0 : @halfmove_clock + 1
      @en_passant = en_passant_target(piece, move)
    end

    def en_passant_target(piece, move)
      return "-" unless piece.upcase == "P"

      from_rank = self.class.rank(move[:from])
      to_rank = self.class.rank(move[:to])
      return "-" unless (from_rank - to_rank).abs == 2

      self.class.square_name(self.class.file_index(move[:from]), (from_rank + to_rank) / 2)
    end

    def switch_turn
      if @turn == "black"
        @fullmove_number += 1
        @turn = "white"
      else
        @turn = "black"
      end
    end

    def to_file(square)
      self.class.file_index(square)
    end

    def to_rank(square)
      self.class.rank(square)
    end

    def square_name(file, rank)
      self.class.square_name(file, rank)
    end
  end
end
