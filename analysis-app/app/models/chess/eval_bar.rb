# frozen_string_literal: true

require_relative "model_support"

module Chess
  # Widget-friendly evaluation split that always sums to 100.
  class EvalBar
    include ModelSupport

    attr_accessor :white, :black

    def self.from_evaluation(evaluation)
      white = if evaluation.mate?
        evaluation.white_favored? ? 98 : 2
      else
        (50 + evaluation.value / 20).clamp(2, 98)
      end

      new(white: white, black: 100 - white).validate!
    end

    def validate!
      raise ArgumentError, "eval_bar values must sum to 100" unless white + black == 100

      self
    end

    def to_h
      {white: white, black: black}
    end
  end
end
