# frozen_string_literal: true

require "fileutils"
require "logger"
require "time"
begin
  require "rails"
  require "active_record/railtie"
  require "action_controller/railtie"
rescue LoadError
  # Domain scripts and syntax checks can run without Rails installed locally.
end

# App-level configuration for the Rails analysis service and domain scripts.
module AnalysisApp
  ROOT = File.expand_path("..", __dir__)
  MONOREPO_ROOT = File.expand_path("..", ROOT)
  PUBLIC_ROOT = File.join(ROOT, "public")
  LOG_ROOT = File.join(ROOT, "log")

  def self.load_env_file(path = File.join(MONOREPO_ROOT, ".env"))
    return unless File.file?(path)

    File.foreach(path) do |line|
      line = line.strip
      next if line.empty? || line.start_with?("#") || !line.include?("=")

      key, value = line.split("=", 2)
      next if key.empty? || ENV.key?(key)

      ENV[key] = value.to_s.gsub(/\A['"]|['"]\z/, "")
    end
  end

  load_env_file

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

if defined?(Rails)
  module AnalysisApp
    # Minimal Rails application for the chess analysis proof of concept.
    class Application < Rails::Application
      config.load_defaults 8.0
      config.root = ROOT
      config.eager_load = false
      config.autoload_paths << File.join(ROOT, "app", "services")
      config.autoload_paths << File.join(ROOT, "app", "models")
      config.public_file_server.enabled = true
      config.public_file_server.headers = {"cache-control" => "public, max-age=3600"}
      config.secret_key_base = ENV.fetch("SECRET_KEY_BASE", "development-secret-key-base")
      config.logger = AnalysisApp.build_logger
      config.hosts.clear
    end
  end
end
