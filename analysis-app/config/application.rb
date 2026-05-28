# frozen_string_literal: true

# Rails-compatible placeholder. If Rails is installed later, this directory can
# be expanded into a normal Rails app while keeping app/services/chess intact.
begin
  require "rails"
rescue LoadError
  # Dependency-free POC mode uses bin/server.
end
