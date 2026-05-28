# frozen_string_literal: true

module Chess
  # Produces monospace-friendly text analysis for terminals and `<pre>` blocks.
  #
  # Moves use Unicode pieces and compact annotation marks, followed by a simple
  # text evaluation bar per move pair.
  class TextAnalysisRenderer
    PIECES = {
      "K" => "♔", "Q" => "♕", "R" => "♖", "B" => "♗", "N" => "♘", "P" => "♙",
      "k" => "♚", "q" => "♛", "r" => "♜", "b" => "♝", "n" => "♞", "p" => "♟"
    }.freeze
    MARKS = {
      "brilliant" => "!!",
      "good" => "!",
      "mistake" => "?!",
      "blunder" => "??",
      "checkmate" => "#"
    }.freeze

    def render(payload)
      metadata = payload.fetch(:metadata)
      moves = payload.fetch(:moves)
      lines = []
      lines << "#{metadata.fetch("White", "White")}#{elo(metadata["WhiteElo"])} vs #{metadata.fetch("Black", "Black")}#{elo(metadata["BlackElo"])}"
      lines << "Result: #{metadata.fetch("Result", "*")}"
      lines << ""

      moves.each_slice(2) do |pair|
        white = pair[0]
        black = pair[1]
        move_parts = ["#{white[:move_number]}. #{render_move(white)}"]
        move_parts << render_move(black) if black
        lines << move_parts.join("      ")
        eval_source = black || white
        lines << "   #{render_eval(eval_source[:eval_after])}"
        lines << ""
      end

      lines.join("\n").rstrip
    end

    private

    def render_move(move)
      if move[:piece] == "P"
        body = move[:san]
        piece = pawn_symbol(move[:color])
      elsif move[:flags]["castling"]
        body = move[:san]
        piece = ""
      else
        body = move[:san].sub(/\A[KQRBN]/, "")
        piece = piece_symbol(move[:color], move[:piece])
      end

      "#{piece}#{body} #{MARKS.fetch(move[:annotation], "!")}"
    end

    def piece_symbol(color, piece)
      key = (color == "white") ? piece : piece.downcase
      PIECES.fetch(key)
    end

    def pawn_symbol(color)
      (color == "white") ? PIECES.fetch("P") : PIECES.fetch("p")
    end

    def render_eval(evaluation)
      percent = eval_percent(evaluation)
      filled = (percent / 5.0).round.clamp(0, 20)
      bar = ("█" * filled) + ("░" * (20 - filled))
      "Eval: White [#{bar}] Black #{eval_label(evaluation)}"
    end

    def eval_percent(evaluation)
      return 50 unless evaluation
      return evaluation[:value].positive? ? 98 : 2 if evaluation[:type].to_s == "mate"

      (50 + evaluation[:value].to_i / 20).clamp(2, 98)
    end

    def eval_label(evaluation)
      return "+0.0" unless evaluation
      return "Mate" if evaluation[:type].to_s == "mate"

      value = evaluation[:value].to_i / 100.0
      (value >= 0) ? format("+%.1f", value) : format("%.1f", value)
    end

    def elo(value)
      value ? " (#{value})" : ""
    end
  end
end
