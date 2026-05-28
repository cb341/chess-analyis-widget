# frozen_string_literal: true

module Chess
  # Produces copyable Markdown analysis with Unicode pieces, compact annotation
  # marks, and an evaluation bar column.
  class MarkdownAnalysisRenderer
    PIECES = TextAnalysisRenderer::PIECES
    MARKS = TextAnalysisRenderer::MARKS
    FILES = %w[a b c d e f g h].freeze
    RANKS = [8, 7, 6, 5, 4, 3, 2, 1].freeze

    def render(payload)
      metadata = payload.fetch(:metadata)
      moves = payload.fetch(:moves)
      lines = []
      lines << "# #{metadata.fetch("White", "White")}#{elo(metadata["WhiteElo"])} vs #{metadata.fetch("Black", "Black")}#{elo(metadata["BlackElo"])}"
      lines << ""
      lines << "- **Result:** #{metadata.fetch("Result", "*")}"
      lines << "- **Summary:** #{payload.fetch(:summary)}"
      lines << ""
      moves.each do |move|
        position = payload.fetch(:positions).fetch(move[:ply])
        lines << "## #{move_label(move)}"
        lines << ""
        lines << "- **Rating:** #{rating(move)}"
        lines << "- **Evaluation:** `#{eval_label(move[:eval_after])}`"
        lines << ""
        lines << '<pre class="analysis-board">'
        lines << board_text(position.fetch(:board))
        lines << "</pre>"
        lines << ""
      end

      lines.join("\n")
    end

    private

    def move_label(move)
      prefix = (move[:color] == "black") ? "#{move[:move_number]}... " : "#{move[:move_number]}. "
      "#{prefix}#{unicode_san(move)}"
    end

    def rating(move)
      "#{MARKS.fetch(move[:annotation], "!")} #{move[:annotation].to_s.tr("_", " ")}"
    end

    def render_move(move)
      "**#{unicode_san(move)}** #{MARKS.fetch(move[:annotation], "!")}"
    end

    def board_text(board)
      rows = ["  a b c d e f g h"]
      RANKS.each do |rank|
        rows << "#{rank} #{FILES.map { |file| PIECES.fetch(board.fetch("#{file}#{rank}", ""), "·") }.join(" ")} #{rank}"
      end
      rows << "  a b c d e f g h"
      rows.join("\n")
    end

    def unicode_san(move)
      if move[:piece] == "P"
        "#{pawn_symbol(move[:color])}#{move[:san]}"
      elsif move[:flags]["castling"]
        move[:san]
      else
        "#{piece_symbol(move[:color], move[:piece])}#{move[:san].sub(/\A[KQRBN]/, "")}"
      end
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
      filled = (percent / 10.0).round.clamp(0, 10)
      bar = ("█" * filled) + ("░" * (10 - filled))
      "W [#{bar}] B #{eval_label(evaluation)}"
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
