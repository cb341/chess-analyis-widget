# frozen_string_literal: true

require "json"
require_relative "../services/chess/analysis_builder"
require_relative "../models/analysis"

# Handles the Rails analysis resource: new form, create, and show.
class AnalysesController < ApplicationController
  SAMPLE_PGN = <<~PGN
    [Event "Live Chess"]
    [Site "Chess.com"]
    [Date "2026.05.27"]
    [Round "?"]
    [White "CuddlyBunion341"]
    [Black "KamKam777"]
    [Result "1-0"]
    [TimeControl "300"]
    [WhiteElo "204"]
    [BlackElo "185"]
    [Termination "CuddlyBunion341 won by checkmate"]
    [ECO "A06"]
    [EndTime "19:50:16 GMT+0000"]
    [Link "https://www.chess.com/game/live/169329691518?move=0"]

    1. e4 d5 2. Nf3 dxe4 3. Ng5 e5 4. Nxe4 Bf5 5. d3 Qc8 6. Be2 Bg4 7. Bxg4 f5 8.
    Bh3 fxe4 9. Bxc8 Nc6 10. dxe4 Rxc8 11. O-O Rd8 12. Bd2 Bb4 13. c3 Bc5 14. b4 Bb6
    15. b5 Na5 16. Qh5+ g6 17. Qxe5+ Ne7 18. Qxh8+ Kd7 19. Qxh7 Nc4 20. Rd1 Rf8 21.
    Bh6+ Ke8 22. Bxf8 Kxf8 23. Rd8# 1-0
  PGN

  def new
    Rails.logger.debug("render analyses#new")
    @pgn = SAMPLE_PGN
  end

  def create
    pgn = params.fetch(:pgn, "")
    Rails.logger.info("analysis create started pgn_bytes=#{pgn.bytesize}")
    payload = Chess::AnalysisBuilder.new.build(pgn)
    analysis = Analysis.create_from_pgn!(pgn: pgn, payload: payload)
    Rails.logger.info("analysis create saved id=#{analysis.id} moves=#{payload[:moves].length} positions=#{payload[:positions].length}")
    redirect_to analysis_path(analysis.id), status: :see_other
  rescue => error
    Rails.logger.error("analysis create failed class=#{error.class} message=#{error.message}")
    @pgn = pgn
    @error = error.message
    render :new, status: :unprocessable_entity
  end

  def show
    analysis = Analysis.find_by(id: params.fetch(:id))
    return redirect_to new_analysis_path, alert: "Analysis not found." unless analysis

    @analysis_id = analysis.id
    @pgn = analysis.pgn
    @payload = symbolize(analysis.payload)
    @payload_json = JSON.pretty_generate(@payload)
    widget_css_url = "#{request.base_url}/chess-widget.css"
    widget_js_url = "#{request.base_url}/chess-widget.js"
    @embed_css = "<link rel=\"stylesheet\" href=\"#{widget_css_url}\">\n"
    @embed_html = <<~HTML
      <script type="application/json" id="game-data">
      #{@payload_json}
      </script>
      <chess-widget data-source="game-data"></chess-widget>
    HTML
    @embed_js = "<script src=\"#{widget_js_url}\"></script>\n"
  end

  private

  def symbolize(value)
    case value
    when Hash
      value.each_with_object({}) { |(key, item), result| result[key.to_sym] = symbolize(item) }
    when Array
      value.map { |item| symbolize(item) }
    else
      value
    end
  end
end
