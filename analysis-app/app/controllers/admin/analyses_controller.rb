# frozen_string_literal: true

require "erb"
require_relative "../../../config/application"
require_relative "../../models/analysis_repository"

module Admin
  # Read-only admin screens for saved analysis payloads and board snapshots.
  class AnalysesController
    def initialize(repository: AnalysisRepository.new)
      @repository = repository
    end

    def index
      analyses = @repository.all
      AnalysisApp.logger.debug("admin analyses#index count=#{analyses.length}")
      render_template("index", analyses: analyses)
    end

    def show(params)
      analysis = @repository.find(params.fetch("id"))
      AnalysisApp.logger.debug("admin analyses#show id=#{params.fetch("id")} found=#{!analysis.nil?}")
      return not_found unless analysis

      render_template("show", analysis: analysis)
    end

    private

    def not_found
      render_template("not_found", analysis: nil)
    end

    def render_template(name, locals)
      path = File.expand_path("../../views/admin/analyses/#{name}.html.erb", __dir__)
      context = ViewContext.new(locals)
      ERB.new(File.read(path), trim_mode: "-").result(context.get_binding)
    end

    # Small view context for admin templates.
    class ViewContext
      PIECES = {
        "K" => "♔", "Q" => "♕", "R" => "♖", "B" => "♗", "N" => "♘", "P" => "♙",
        "k" => "♚", "q" => "♛", "r" => "♜", "b" => "♝", "n" => "♞", "p" => "♟"
      }.freeze

      FILES = %w[a b c d e f g h].freeze
      RANKS = [8, 7, 6, 5, 4, 3, 2, 1].freeze

      def initialize(locals)
        locals.each { |key, value| instance_variable_set("@#{key}", value) }
      end

      def get_binding
        binding
      end

      def h(value)
        value.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub('"', "&quot;")
      end

      def board_text(position)
        board = position.fetch("board", {})
        RANKS.map do |rank|
          FILES.map { |file| PIECES.fetch(board["#{file}#{rank}"], "·") }.join(" ")
        end.join("\n")
      end

      def title_for(analysis)
        metadata = analysis.metadata
        "#{metadata.fetch("White", "White")} vs #{metadata.fetch("Black", "Black")}"
      end
    end
  end
end
