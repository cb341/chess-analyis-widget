# frozen_string_literal: true

# Streams a tiny progress page while synchronous analysis runs.
class ProgressStream
  def initialize(output)
    @output = output
    @started = false
    @steps = 0
  end

  def progress(message)
    start unless @started
    @steps += 1
    write <<~HTML
      <script>
        window.analysisProgress && window.analysisProgress(#{@steps}, #{message.inspect});
      </script>
    HTML
  end

  def finish(html)
    if @started
      write <<~HTML
        <script>
          document.open();
          document.write(#{javascript_string(html)});
          document.close();
        </script>
      HTML
    else
      write html
    end
  end

  private

  def write(chunk)
    @output.write(chunk)
  end

  def javascript_string(value)
    value.inspect.gsub("</", '<\/')
  end

  def start
    @started = true
    write <<~HTML
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
              <div class="progress-bar"><span id="analysis-progress-bar"></span></div>
              <p id="analysis-progress-message">Starting analysis...</p>
              <ol id="analysis-progress-log"></ol>
            </div>
          </main>
          <script>
            window.analysisProgress = function(step, message) {
              var percent = Math.min(95, 10 + step * 3);
              var bar = document.getElementById("analysis-progress-bar");
              var text = document.getElementById("analysis-progress-message");
              var log = document.getElementById("analysis-progress-log");
              if (bar) bar.style.width = percent + "%";
              if (text) text.textContent = message;
              if (log) {
                var item = document.createElement("li");
                item.textContent = message;
                log.appendChild(item);
              }
            };
          </script>
    HTML
  end
end
