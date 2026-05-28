# frozen_string_literal: true

module Chess
  # Converts before/after evaluations into simple move quality labels.
  #
  # The thresholds are intentionally coarse for the POC and can be replaced by
  # richer Stockfish multi-PV analysis later.
  class MoveClassifier
    def classify(move, eval_before, eval_after)
      return "checkmate" if move[:flags]["checkmate"]

      loss = eval_loss(move[:color], eval_before, eval_after)
      return "blunder" if loss >= 151
      return "mistake" if loss >= 51

      gain = eval_gain(move[:color], eval_before, eval_after)
      return "brilliant" if gain >= 150 && (move[:flags]["capture"] || move[:flags]["check"])

      "good"
    end

    def eval_loss(color, before_eval, after_eval)
      before = centipawns(before_eval)
      after = centipawns(after_eval)
      delta = (color == "white") ? before - after : after - before
      [delta, 0].max
    end

    private

    def eval_gain(color, before_eval, after_eval)
      before = centipawns(before_eval)
      after = centipawns(after_eval)
      delta = (color == "white") ? after - before : before - after
      [delta, 0].max
    end

    def centipawns(evaluation)
      return 0 unless evaluation
      return evaluation[:value].to_i if evaluation[:type].to_s == "cp"

      mate = evaluation[:value].to_i
      mate.positive? ? 10_000 : -10_000
    end
  end
end
