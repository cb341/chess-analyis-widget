# frozen_string_literal: true

require "json"
require "tmpdir"
require_relative "../../analysis-app/config/application"
require_relative "../../analysis-app/app/controllers/application_controller"
require_relative "../../analysis-app/app/controllers/analyses_controller"
require_relative "../../analysis-app/app/models/analysis"
require_relative "../../analysis-app/app/services/chess/analysis_builder"
require_relative "../../analysis-app/app/services/chess/stockfish_analyzer"
