# frozen_string_literal: true

require "fileutils"
require "json"
require "securerandom"
require "time"
require_relative "analysis_record"
require_relative "../../config/application"

# File-backed storage for analyzed games in the dependency-light POC.
class AnalysisRepository
  def initialize(root: File.join(AnalysisApp::ROOT, "storage", "analyses"))
    @root = root
  end

  def create(pgn:, payload:)
    FileUtils.mkdir_p(@root)
    record = AnalysisRecord.new(
      id: SecureRandom.hex(8),
      pgn: pgn,
      payload: stringify(payload),
      created_at: Time.now.utc.iso8601
    )
    File.write(path_for(record.id), JSON.pretty_generate(record.to_h))
    record
  end

  def all
    Dir.glob(File.join(@root, "*.json"))
      .sort
      .reverse
      .map { |path| AnalysisRecord.from_h(JSON.parse(File.read(path))) }
  end

  def find(id)
    path = path_for(id)
    return nil unless File.file?(path)

    AnalysisRecord.from_h(JSON.parse(File.read(path)))
  end

  private

  def path_for(id)
    safe_id = id.to_s.gsub(/[^a-zA-Z0-9_-]/, "")
    File.join(@root, "#{safe_id}.json")
  end

  def stringify(value)
    JSON.parse(JSON.generate(value))
  end
end
