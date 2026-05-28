# frozen_string_literal: true

require "json"
require "erb"
require_relative "../services/chess/analysis_builder"
require_relative "../models/analysis"

# Handles the Rails analysis resource: new form, create, and show.
class AnalysesController < ApplicationController
  include ActionController::Live

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
    stream_analysis(pgn)
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
    @payload_json_minified = JSON.generate(@payload)
    widget_css_url = "#{request.base_url}/chess-widget.css"
    widget_js_url = "#{request.base_url}/chess-widget.js"
    @embed_widget = <<~HTML
      <link rel="stylesheet" href="#{widget_css_url}">
      <script type="application/json" id="game-data">
      #{@payload_json_minified}
      </script>
      <chess-widget data-source="game-data"></chess-widget>
      <script src="#{widget_js_url}"></script>
    HTML
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

  def stream_analysis(pgn)
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    response.stream.write(progress_page)

    step = 0
    Rails.logger.info("analysis stream started pgn_bytes=#{pgn.bytesize}")
    payload = Chess::AnalysisBuilder.new.build(
      pgn,
      progress: lambda { |message|
        step += 1
        Rails.logger.debug("analysis progress #{message}")
        write_progress(step, message)
      }
    )
    analysis = Analysis.create_from_pgn!(pgn: pgn, payload: payload)
    Rails.logger.info("analysis stream saved id=#{analysis.id} moves=#{payload[:moves].length} positions=#{payload[:positions].length}")
    write_progress(step + 1, "Analysis complete")
    write_redirect(analysis_path(analysis.id))
  rescue => error
    Rails.logger.error("analysis stream failed class=#{error.class} message=#{error.message}")
    write_error(error.message)
  ensure
    response.stream.close
  end

  def write_progress(step, message)
    percent = (10 + (step * 3)).clamp(6, 95)
    response.stream.write(turbo_stream("update", "analysis-progress-bar", %(<span style="width: #{percent}%"></span>)))
    response.stream.write(turbo_stream("update", "analysis-progress-message", escape_html(message)))
    response.stream.write(turbo_stream("append", "analysis-progress-log", %(<li>#{escape_html(message)}</li>)))
  end

  def write_redirect(path)
    response.stream.write(turbo_stream("replace", "analysis-progress-result", <<~HTML))
      <p class="summary">Analysis complete. Opening result...</p>
      <script>window.location.href = #{path.to_json};</script>
    HTML
  end

  def write_error(message)
    response.stream.write(turbo_stream("replace", "analysis-progress-result", <<~HTML))
      <p class="error">#{escape_html(message)}</p>
      <p><a href="/">Back to analysis form</a></p>
    HTML
  end

  def escape_html(value)
    ERB::Util.html_escape(value.to_s)
  end

  def turbo_stream(action, target, template)
    <<~HTML
      <turbo-stream action="#{action}" target="#{target}">
        <template>#{template}</template>
      </turbo-stream>
    HTML
  end

  def progress_page
    <<~HTML
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Analyzing Chess Game</title>
          <link rel="stylesheet" href="/app.css">
        </head>
        <body>
          <main class="page">
            <h1>Analyzing game</h1>
            <div class="progress-shell" role="status" aria-live="polite">
              <div class="progress-bar" id="analysis-progress-bar"><span></span></div>
              <p id="analysis-progress-message">Starting analysis...</p>
              <ol id="analysis-progress-log"></ol>
              <div id="analysis-progress-result"></div>
            </div>
          </main>
          <script>
            (function () {
              function runScripts(root) {
                root.querySelectorAll("script").forEach(function (script) {
                  var copy = document.createElement("script");
                  copy.textContent = script.textContent;
                  script.replaceWith(copy);
                });
              }

              function applyStream(stream) {
                var target = document.getElementById(stream.getAttribute("target"));
                var template = stream.querySelector("template");
                if (!target || !template) {
                  stream.remove();
                  return;
                }

                var action = stream.getAttribute("action");
                var content = template.content.cloneNode(true);
                if (action === "append") {
                  target.appendChild(content);
                } else if (action === "replace") {
                  target.replaceChildren(content);
                } else {
                  target.replaceChildren(content);
                }
                runScripts(target);
                if (target.scrollTo) target.scrollTo(0, target.scrollHeight);
                stream.remove();
              }

              new MutationObserver(function () {
                document.querySelectorAll("turbo-stream").forEach(applyStream);
              }).observe(document.documentElement, { childList: true, subtree: true });
              document.querySelectorAll("turbo-stream").forEach(applyStream);
            })();
          </script>
        </body>
      </html>
    HTML
  end
end
