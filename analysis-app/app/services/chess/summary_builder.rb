# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Produces a short human-readable game summary from the analyzed payload.
  class SummaryBuilder
    def build(payload)
      moves = payload.fetch(:moves)
      sentences = []

      moves.select { |move| move[:flags]["castling"] }.each do |move|
        sentences << "#{move[:color].capitalize} castled on move #{move[:move_number]}."
      end

      moves.select { |move| move[:annotation] == "blunder" }.first(3).each do |move|
        sentences << "#{move[:color].capitalize} blundered with #{move[:move_number]}. #{move[:san]}."
      end

      moves.select { |move| move[:flags]["check"] && !move[:flags]["checkmate"] }.first(3).each do |move|
        sentences << "#{move[:move_number]}. #{move[:san]} gave check."
      end

      mate = moves.find { |move| move[:flags]["checkmate"] }
      if mate
        sentences << "The game ended with #{mate[:move_number]}. #{mate[:san]} checkmate."
      elsif payload[:metadata]["Result"]
        sentences << "The game ended #{payload[:metadata]["Result"]}."
      end

      sentences.empty? ? "Game analyzed with #{moves.length} moves." : sentences.join(" ")
    end
  end
end
