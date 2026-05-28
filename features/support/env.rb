# frozen_string_literal: true

require "json"
require "tmpdir"
require_relative "../../analysis-app/app/controllers/analyses_controller"
require_relative "../../analysis-app/app/controllers/admin/analyses_controller"
require_relative "../../analysis-app/app/controllers/progress_stream"
require_relative "../../analysis-app/app/models/analysis_repository"
require_relative "../../analysis-app/app/services/chess/analysis_builder"
require_relative "../../analysis-app/app/services/chess/stockfish_analyzer"
