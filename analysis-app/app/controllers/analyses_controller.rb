# frozen_string_literal: true

require "json"
require "erb"
require_relative "../../config/application"
require_relative "../services/chess/analysis_builder"
require_relative "../models/analysis_repository"

# Handles the dependency-free analysis form flow used by the WEBrick fallback
# and mirrors the intended Rails controller boundary.
class AnalysesController
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

  def initialize(builder: Chess::AnalysisBuilder.new, repository: AnalysisRepository.new)
    @builder = builder
    @repository = repository
  end

  def new
    AnalysisApp.logger.debug("render analyses#new")
    render_template("new", pgn: SAMPLE_PGN, error: nil)
  end

  def create(params)
    pgn = params.fetch("pgn", "")
    AnalysisApp.logger.info("analysis create started pgn_bytes=#{pgn.bytesize}")
    payload = @builder.build(pgn)
    analysis = @repository.create(pgn: pgn, payload: payload)
    AnalysisApp.logger.info("analysis create saved id=#{analysis.id} moves=#{payload[:moves].length} positions=#{payload[:positions].length}")
    redirect_to("/analyses/#{analysis.id}")
  rescue => error
    AnalysisApp.logger.error("analysis create failed class=#{error.class} message=#{error.message}")
    render_template("new", pgn: pgn, error: error.message)
  end

  def show(params)
    analysis = @repository.find(params.fetch("id"))
    return render_template("new", pgn: SAMPLE_PGN, error: "Analysis not found.") unless analysis

    render_show(pgn: analysis.pgn, payload: symbolize(analysis.payload), analysis_id: analysis.id)
  end

  private

  def redirect_to(location)
    {
      status: 303,
      headers: {"Location" => location},
      body: "See Other"
    }
  end

  def render_show(pgn:, payload:, analysis_id:)
    payload_json = JSON.pretty_generate(payload)
    render_template(
      "show",
      pgn: pgn,
      payload: payload,
      payload_json: payload_json,
      analysis_id: analysis_id,
      embed_css: embed_css,
      embed_html: embed_html(payload_json),
      embed_js: embed_js,
      error: nil
    )
  end

  def symbolize(value)
    case value
    when Hash
      value.each_with_object({}) do |(key, item), result|
        result[key.to_sym] = symbolize(item)
      end
    when Array
      value.map { |item| symbolize(item) }
    else
      value
    end
  end

  def render_template(name, locals)
    path = File.expand_path("../views/analyses/#{name}.html.erb", __dir__)
    context = ViewContext.new(locals)
    ERB.new(File.read(path), trim_mode: "-").result(context.get_binding)
  end

  def embed_css
    <<~HTML
      <link rel="stylesheet" href="/chess-widget.css">
    HTML
  end

  def embed_html(payload_json)
    <<~HTML
      <script type="application/json" id="game-data">
      #{payload_json}
      </script>
      <chess-widget data-source="game-data"></chess-widget>
    HTML
  end

  def embed_js
    <<~HTML
      <script src="/chess-widget.js"></script>
    HTML
  end

  # Minimal ERB context for escaping HTML and embedding script-safe JSON.
  class ViewContext
    def initialize(locals)
      locals.each { |key, value| instance_variable_set("@#{key}", value) }
    end

    def get_binding
      binding
    end

    def h(value)
      value.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub('"', "&quot;")
    end

    def json_script(value)
      value.to_s.gsub("</", '<\/').gsub("<", "\\u003c")
    end
  end
end
