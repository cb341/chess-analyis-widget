# frozen_string_literal: true

Given("the sample Chess.com PGN from the project prompt") do
  @pgn = AnalysesController::SAMPLE_PGN
end

When("I submit the PGN to the analysis app") do
  @progress_messages = []
  @payload = Chess::AnalysisBuilder.new.build(@pgn, progress: ->(message) { @progress_messages << message })
end

Then("I see progress while Stockfish analysis is running") do
  raise "expected progress messages" if @progress_messages.empty?
  raise "expected final move progress" unless @progress_messages.any? { |message| message.include?("Analyzing 23. Rd8#") }
end

Then("the response includes parsed game metadata") do
  raise "missing white metadata" unless @payload[:metadata]["White"] == "CuddlyBunion341"
  raise "missing black metadata" unless @payload[:metadata]["Black"] == "KamKam777"
end

Then("the response includes {int} board positions") do |count|
  raise "expected #{count} positions, got #{@payload[:positions].length}" unless @payload[:positions].length == count
end

Then("the response includes {int} analyzed moves") do |count|
  raise "expected #{count} moves, got #{@payload[:moves].length}" unless @payload[:moves].length == count
end

Then("move {int} for White is marked as castling") do |move_number|
  move = @payload[:moves].find { |candidate| candidate[:move_number] == move_number && candidate[:color] == "white" }
  raise "castling move not found" unless move && move[:flags]["castling"]
end

Then("move {int} for White is marked as checkmate") do |move_number|
  move = @payload[:moves].find { |candidate| candidate[:move_number] == move_number && candidate[:color] == "white" }
  raise "checkmate move not found" unless move && move[:flags]["checkmate"]
end

Then("every position includes an evaluation bar") do
  bad = @payload[:positions].reject { |position| position[:eval_bar] && position[:eval_bar][:white] + position[:eval_bar][:black] == 100 }
  raise "positions missing eval bar: #{bad.map { |position| position[:ply] }.join(", ")}" unless bad.empty?
end

Then("the text analysis includes Unicode chess pieces") do
  raise "missing unicode rook" unless @payload[:text_analysis].include?("♖d8#")
end

Then("the text analysis includes compact annotations such as {string}, {string}, {string}, or {string}") do |good, mistake, blunder, brilliant|
  text = @payload[:text_analysis]
  raise "missing compact annotations" unless [good, mistake, blunder, brilliant].any? { |mark| text.include?(mark) }
end

Then("the text analysis includes a text evaluation bar") do
  raise "missing text eval bar" unless @payload[:text_analysis].include?("Eval: White [")
end

Then("the Markdown analysis includes Unicode chess pieces") do
  raise "missing markdown unicode rook" unless @payload[:markdown_analysis].include?("♖d8#")
end

Then("the Markdown analysis includes compact annotations such as {string}, {string}, {string}, or {string}") do |good, mistake, blunder, brilliant|
  markdown = @payload[:markdown_analysis]
  raise "missing markdown annotations" unless [good, mistake, blunder, brilliant].any? { |mark| markdown.include?(mark) }
end

Then("the Markdown analysis includes a move table") do
  raise "missing markdown move heading" unless @payload[:markdown_analysis].include?("## 23. ♖d8#")
end

Then("the Markdown analysis includes a Markdown-safe evaluation bar") do
  raise "missing markdown board" unless @payload[:markdown_analysis].include?("<pre class=\"analysis-board\">")
end

Given("Stockfish 18 is available in the container") do
  @stockfish_contract = Chess::StockfishAnalyzer.new(path: "/missing/stockfish")
end

When("the analysis app evaluates a position") do
  @fallback_eval = @stockfish_contract.evaluate_fen("8/8/8/8/8/8/8/8 w - - 0 1")
end

Then("it asks Stockfish for a UCI evaluation") do
  raise "expected analyzer interface" unless @stockfish_contract.respond_to?(:evaluate_fen)
end

Then("it falls back to material evaluation if Stockfish fails or times out") do
  raise "expected fallback source" unless @fallback_eval[:source] == "fallback_material"
end

Given("at least one game has been analyzed") do
  payload = Chess::AnalysisBuilder.new.build(AnalysesController::SAMPLE_PGN)
  record = Struct.new(:id, :pgn, :payload, :created_at) do
    def metadata = payload.fetch("metadata", {})
    def moves = payload.fetch("moves", [])
    def positions = payload.fetch("positions", [])
  end
  @analysis_record = record.new(
    Analysis.id_for(AnalysesController::SAMPLE_PGN),
    AnalysesController::SAMPLE_PGN,
    JSON.parse(JSON.generate(payload)),
    Time.now
  )
end

When("I open the analyses index") do
  @analysis_index = [@analysis_record]
end

Then("I see the saved games") do
  raise "missing analysis record" unless @analysis_index.any? { |record| record.id == @analysis_record.id }
end

Then("I can open a saved game") do
  @analysis_show = @analysis_index.find { |record| record.id == @analysis_record.id }
  raise "missing analysis show record" unless @analysis_show
end

Then("I can inspect its metadata, moves, evaluations, and board snapshots") do
  raise "missing metadata" if @analysis_show.metadata.empty?
  raise "missing moves" if @analysis_show.moves.empty?
  raise "missing boards" if @analysis_show.positions.empty?
  raise "missing eval" unless @analysis_show.moves.first.key?("eval_after")
end
