# frozen_string_literal: true

Given("a page with embedded analyzed JSON") do
  @widget_html = File.read("widget-demo/index.html")
  @widget_js = File.read("widget-demo/chess-widget.js")
end

Given("the page contains {string}") do |element|
  raise "missing #{element}" unless @widget_html.include?(element)
end

When("the widget connects to the page") do
  @widget_connected = @widget_js.include?("connectedCallback")
end

Then("it reads the JSON from the DOM") do
  raise "missing JSON DOM loading" unless @widget_js.include?("JSON.parse") && @widget_js.include?("getElementById")
end

Then("it renders the starting board") do
  raise "missing starting position" unless @widget_html.include?('"ply": 0') && @widget_js.include?("renderBoard")
end

Then("it does not call fetch, XMLHttpRequest, WebSocket, or EventSource") do
  forbidden = %w[fetch XMLHttpRequest WebSocket EventSource]
  matches = forbidden.select { |name| @widget_js.include?(name) }
  raise "forbidden APIs found: #{matches.join(", ")}" unless matches.empty?
end

When("I press the next control") do
  @next_supported = @widget_js.include?("next()")
end

Then("the widget advances to the next board position") do
  raise "missing next support" unless @next_supported && @widget_js.include?("this.currentPly + 1")
end

Then("it highlights the last move") do
  raise "missing last move highlight" unless @widget_js.include?("cw-last-move")
end

Then("it updates the annotation overlay") do
  raise "missing annotation rendering" unless @widget_js.include?("renderAnnotation")
end

Then("it updates the evaluation bar") do
  raise "missing eval rendering" unless @widget_js.include?("cw-eval")
end

When("the widget has focus") do
  @keyboard_supported = @widget_js.include?("keydown")
end

Then("ArrowRight advances one ply") do
  raise "missing ArrowRight" unless @keyboard_supported && @widget_js.include?("ArrowRight")
end

Then("ArrowLeft goes back one ply") do
  raise "missing ArrowLeft" unless @keyboard_supported && @widget_js.include?("ArrowLeft")
end

Then("Home jumps to the start") do
  raise "missing Home" unless @keyboard_supported && @widget_js.include?("Home")
end

Then("End jumps to the final position") do
  raise "missing End" unless @keyboard_supported && @widget_js.include?("End")
end

When("I choose a move from the move list") do
  @move_list_supported = @widget_js.include?("renderMoveList")
end

Then("the widget jumps to that ply") do
  raise "missing ply jump" unless @move_list_supported && @widget_js.include?("this.goTo(move.ply)")
end

Then("the selected move is marked active") do
  raise "missing active move marker" unless @widget_js.include?("cw-active-move")
end
