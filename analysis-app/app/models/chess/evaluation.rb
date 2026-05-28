# frozen_string_literal: true

require_relative "model_support"

module Chess
  # Engine evaluation normalized to White's perspective.
  class Evaluation
    include ModelSupport

    TYPES = %w[cp mate].freeze
    SOURCES = %w[stockfish fallback_material].freeze

    attr_accessor :type, :value, :source

    def self.from_hash(attributes, context: "evaluation")
      new(attributes).tap { |evaluation| evaluation.validate!(context: context) }
    end

    def validate!(context: "evaluation")
      raise ArgumentError, "#{context} type must be one of #{TYPES.join(", ")}" unless TYPES.include?(type)
      raise ArgumentError, "#{context} value must be an Integer" unless value.is_a?(Integer)
      raise ArgumentError, "#{context} source must be one of #{SOURCES.join(", ")}" unless SOURCES.include?(source)

      self
    end

    def to_h
      {type: type, value: value, source: source}
    end

    def mate?
      type == "mate"
    end

    def white_favored?
      value.positive?
    end
  end
end
