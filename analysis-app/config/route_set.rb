# frozen_string_literal: true

# Shared route declaration for the future Rails app and current WEBrick runner.
ANALYSIS_ROUTES = [
  {verb: "GET", path: "/", controller: "analyses", action: "new", name: "root"},
  {verb: "GET", path: "/analyses/new", controller: "analyses", action: "new", name: "new_analysis"},
  {verb: "POST", path: "/analyses", controller: "analyses", action: "create", name: "analyses"},
  {verb: "GET", path_pattern: %r{\A/analyses/(?<id>[^/]+)\z}, controller: "analyses", action: "show", name: "analysis"},
  {verb: "GET", path: "/admin", controller: "admin/analyses", action: "index", name: "admin"},
  {verb: "GET", path: "/admin/", controller: "admin/analyses", action: "index", name: "admin_slash"},
  {verb: "GET", path: "/admin/analyses", controller: "admin/analyses", action: "index", name: "admin_analyses"},
  {verb: "GET", path_pattern: %r{\A/admin/analyses/(?<id>[^/]+)\z}, controller: "admin/analyses", action: "show", name: "admin_analysis"}
].freeze
