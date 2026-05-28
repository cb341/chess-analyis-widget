# frozen_string_literal: true

require "digest"

# Persisted chess analysis payload keyed by a deterministic hash of the PGN.
class Analysis < ActiveRecord::Base
  self.primary_key = "id"

  validates :id, presence: true
  validates :pgn, presence: true
  validates :payload, presence: true

  before_validation :assign_deterministic_id

  def self.create_from_pgn!(pgn:, payload:)
    analysis = find_or_initialize_by(id: id_for(pgn))
    analysis.pgn = pgn
    analysis.payload = JSON.parse(JSON.generate(payload))
    analysis.save!
    analysis
  end

  def self.id_for(input)
    Digest::SHA256.hexdigest(input.to_s)[0, 16]
  end

  def metadata
    payload.fetch("metadata", {})
  end

  def moves
    payload.fetch("moves", [])
  end

  def positions
    payload.fetch("positions", [])
  end

  def summary
    payload.fetch("summary", "")
  end

  private

  def assign_deterministic_id
    self.id ||= self.class.id_for(pgn)
  end
end
