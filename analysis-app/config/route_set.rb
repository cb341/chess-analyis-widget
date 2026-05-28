# frozen_string_literal: true

# Shared route declaration for the future Rails app and current WEBrick runner.
ANALYSIS_ROUTES = [
  {verb: "GET", path: "/", controller: "analyses", action: "new", name: "root"},
  {verb: "GET", path: "/analyses/new", controller: "analyses", action: "new", name: "new_analysis"},
  {verb: "POST", path: "/analyses", controller: "analyses", action: "create", name: "analyses"}
].freeze
