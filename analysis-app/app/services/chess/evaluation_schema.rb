# frozen_string_literal: true

require_relative "../../models/chess/evaluation"

module Chess
  # Documents and validates the evaluation hash emitted by StockfishAnalyzer.
  #
  # Schema:
  #   {
  #     type: "cp" | "mate",
  #     value: Integer,
  #     source: "stockfish" | "fallback_material"
  #   }
  #
  # Values are always from White's perspective:
  # - positive centipawns mean White is better
  # - negative centipawns mean Black is better
  # - positive mate values mean White has a forced mate
  # - negative mate values mean Black has a forced mate
  class EvaluationSchema
    TYPES = %w[cp mate].freeze
    SOURCES = %w[stockfish fallback_material].freeze

    def self.validate!(evaluation, context: "evaluation")
      raise ArgumentError, "#{context} must be a Hash" unless evaluation.is_a?(Hash)

      Evaluation.from_hash(evaluation, context: context).to_h
    end
  end
end
