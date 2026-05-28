# frozen_string_literal: true

# Creates persisted chess analysis payloads keyed by deterministic input hash.
class CreateAnalyses < ActiveRecord::Migration[8.0]
  def change
    create_table :analyses, id: :string do |t|
      t.text :pgn, null: false
      t.jsonb :payload, null: false, default: {}

      t.timestamps
    end
  end
end
