# frozen_string_literal: true

# App-level configuration for the dependency-light analysis service.
module AnalysisApp
  ROOT = File.expand_path("..", __dir__)
  PUBLIC_ROOT = File.join(ROOT, "public")

  def self.host
    ENV.fetch("HOST", "127.0.0.1")
  end

  def self.port
    Integer(ENV.fetch("PORT", "3000"))
  end
end
