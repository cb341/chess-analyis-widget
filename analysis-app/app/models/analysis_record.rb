# frozen_string_literal: true

require "json"

# Stored analysis metadata and payload for the admin views.
class AnalysisRecord
  attr_reader :id, :pgn, :payload, :created_at

  def initialize(id:, pgn:, payload:, created_at:)
    @id = id
    @pgn = pgn
    @payload = payload
    @created_at = created_at
  end

  def self.from_h(attributes)
    new(
      id: attributes.fetch("id"),
      pgn: attributes.fetch("pgn"),
      payload: attributes.fetch("payload"),
      created_at: attributes.fetch("created_at")
    )
  end

  def to_h
    {
      id: id,
      pgn: pgn,
      payload: payload,
      created_at: created_at
    }
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
end
