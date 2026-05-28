# frozen_string_literal: true

require "fileutils"
require "logger"

# App-level configuration for the dependency-light analysis service.
module AnalysisApp
  ROOT = File.expand_path("..", __dir__)
  PUBLIC_ROOT = File.join(ROOT, "public")
  LOG_ROOT = File.join(ROOT, "log")

  def self.host
    ENV.fetch("HOST", "127.0.0.1")
  end

  def self.port
    Integer(ENV.fetch("PORT", "3000"))
  end

  def self.environment
    ENV.fetch("RACK_ENV", ENV.fetch("RAILS_ENV", "development"))
  end

  def self.logger
    return Rails.logger if defined?(Rails) && Rails.respond_to?(:logger) && Rails.logger

    @logger ||= build_logger
  end

  def self.build_logger
    FileUtils.mkdir_p(LOG_ROOT)
    Logger.new(File.join(LOG_ROOT, "#{environment}.log")).tap do |logger|
      logger.level = (environment == "development") ? Logger::DEBUG : Logger::INFO
      logger.progname = "analysis-app"
      logger.formatter = proc do |severity, time, progname, message|
        "#{time.utc.iso8601(3)} #{severity} #{progname}: #{message}\n"
      end
    end
  end
end
