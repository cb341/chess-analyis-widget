# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Renders analyzed moves as Markdown with Unicode pieces and compact eval bars.
  class MarkdownAnalysisRenderer
    PIECES = TextAnalysisRenderer::PIECES
    MARKS = TextAnalysisRenderer::MARKS

    def render(payload)
      metadata = payload.fetch(:metadata)
      moves = payload.fetch(:moves)
      lines = []
      lines << "# #{metadata.fetch("White", "White")}#{elo(metadata["WhiteElo"])} vs #{metadata.fetch("Black", "Black")}#{elo(metadata["BlackElo"])}"
      lines << ""
      lines << "- **Result:** #{metadata.fetch("Result", "*")}"
      lines << "- **Summary:** #{payload.fetch(:summary)}"
      lines << ""
      lines << "| Move | White | Black | Eval |"
      lines << "| ---: | --- | --- | --- |"

      moves.each_slice(2) do |pair|
        white = pair[0]
        black = pair[1]
        eval_source = black || white
        black_move = black ? render_move(black) : nil
        lines << "| #{white[:move_number]} | #{render_move(white)} | #{black_move} | `#{render_eval(eval_source[:eval_after])}` |"
      end

      lines.join("\n")
    end

    private

    def render_move(move)
      "**#{unicode_san(move)}** #{MARKS.fetch(move[:annotation], "!")}"
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
