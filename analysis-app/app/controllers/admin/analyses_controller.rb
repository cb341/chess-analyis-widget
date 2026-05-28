# frozen_string_literal: true

require_relative "../../models/analysis"

module Admin
  # Read-only Rails admin screens for analysis payloads and board snapshots.
  class AnalysesController < ApplicationController
    PIECES = {
      "K" => "♔", "Q" => "♕", "R" => "♖", "B" => "♗", "N" => "♘", "P" => "♙",
      "k" => "♚", "q" => "♛", "r" => "♜", "b" => "♝", "n" => "♞", "p" => "♟"
    }.freeze
    helper_method :board_text, :title_for

    def index
      @analyses = Analysis.order(created_at: :desc)
      Rails.logger.debug("admin analyses#index count=#{@analyses.length}")
    end

    def show
      @analysis = Analysis.find_by(id: params.fetch(:id))
      Rails.logger.debug("admin analyses#show id=#{params.fetch(:id)} found=#{!@analysis.nil?}")
      render :not_found, status: :not_found unless @analysis
    end

    private

    def board_text(position)
      board = position.fetch("board", {})
      ranks = [8, 7, 6, 5, 4, 3, 2, 1]
      files = %w[a b c d e f g h]

      ranks.map do |rank|
        files.map { |file| PIECES.fetch(board["#{file}#{rank}"], "·") }.join(" ")
      end.join("\n")
    end

    def title_for(analysis)
      metadata = analysis.metadata
      "#{metadata.fetch("White", "White")} vs #{metadata.fetch("Black", "Black")}"
    end
  end
end
