# frozen_string_literal: true

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

      type = evaluation[:type]
      value = evaluation[:value]
      source = evaluation[:source]

      raise ArgumentError, "#{context} type must be one of #{TYPES.join(", ")}" unless TYPES.include?(type)
      raise ArgumentError, "#{context} value must be an Integer" unless value.is_a?(Integer)
      raise ArgumentError, "#{context} source must be one of #{SOURCES.join(", ")}" unless SOURCES.include?(source)

      evaluation
    end
  end
end
