# frozen_string_literal: true

require_relative "pgn_parser"
require_relative "board"
require_relative "move_resolver"
require_relative "fen_builder"
require_relative "stockfish_analyzer"
require_relative "move_classifier"
require_relative "summary_builder"
require_relative "text_analysis_renderer"
require_relative "markdown_analysis_renderer"

module Chess
  # Orchestrates PGN parsing, board replay, evaluation, annotation, and response
  # rendering into one payload for the UI and copyable analysis formats.
  class AnalysisBuilder
    def initialize(
      parser: PgnParser.new,
      resolver: MoveResolver.new,
      fen_builder: FenBuilder.new,
      analyzer: StockfishAnalyzer.new,
      classifier: MoveClassifier.new,
      summary_builder: SummaryBuilder.new,
      text_renderer: TextAnalysisRenderer.new,
      markdown_renderer: MarkdownAnalysisRenderer.new
    )
      @parser = parser
      @resolver = resolver
      @fen_builder = fen_builder
      @analyzer = analyzer
      @classifier = classifier
      @summary_builder = summary_builder
      @text_renderer = text_renderer
      @markdown_renderer = markdown_renderer
    end

    def build(pgn)
      parsed = @parser.parse(pgn)
      board = Board.new
      positions = []
      moves = []
      ply = 0
      current_eval = evaluate(board)
      positions << position_payload(board, ply, 0, nil, nil, nil, current_eval)

      parsed[:moves].each_with_index do |san, index|
        move_number = (index / 2) + 1
        color = board.current_color
        fen_before = @fen_builder.build(board)
        eval_before = current_eval
        resolved = @resolver.resolve(board, san)
        resolved[:color] = color
        resolved[:move_number] = move_number
        resolved[:ply] = ply + 1
        resolved[:fen_before] = fen_before

        applied = board.apply_move(resolved)
        current_eval = evaluate(board)
        applied[:eval_before] = eval_before
        applied[:eval_after] = current_eval
        applied[:eval_loss] = @classifier.eval_loss(color, eval_before, current_eval)
        applied[:annotation] = @classifier.classify(applied, eval_before, current_eval)
        applied[:fen_after] = @fen_builder.build(board)

        ply += 1
        moves << move_payload(applied)
        positions << position_payload(board, ply, move_number, color, san, applied, current_eval)
      rescue => error
        raise ArgumentError, "Move #{move_number} #{color} #{san}: #{error.message}"
      end

      payload = {
        version: 1,
        metadata: parsed[:metadata],
        summary: "",
        text_analysis: "",
        markdown_analysis: "",
        positions: positions,
        moves: moves,
        analyzer: {
          stockfish_available: @analyzer.available?,
          note: @analyzer.available? ? "Stockfish interface stubbed in first pass" : "Using fallback material evaluator"
        }
      }
      payload[:summary] = @summary_builder.build(payload)
      payload[:text_analysis] = @text_renderer.render(payload)
      payload[:markdown_analysis] = @markdown_renderer.render(payload)
      payload
    end

    private

    def evaluate(board)
      @analyzer.evaluate_fen(@fen_builder.build(board), board: board)
    end

    def move_payload(move)
      {
        ply: move[:ply],
        move_number: move[:move_number],
        color: move[:color],
        san: move[:san],
        from: move[:from],
        to: move[:to],
        piece: move[:piece],
        captured: move[:captured],
        promotion: move[:promotion],
        annotation: move[:annotation],
        eval_before: clean_eval(move[:eval_before]),
        eval_after: clean_eval(move[:eval_after]),
        eval_loss: move[:eval_loss],
        flags: move[:flags],
        fen_before: move[:fen_before],
        fen_after: move[:fen_after]
      }
    end

    def position_payload(board, ply, move_number, color, san, move, evaluation)
      {
        ply: ply,
        move_number: move_number,
        color: color,
        san: san,
        board: board.snapshot,
        last_move: move ? {from: move[:from], to: move[:to]} : nil,
        annotation: move && move[:annotation],
        eval: clean_eval(evaluation),
        eval_bar: eval_bar(evaluation),
        flags: move ? move[:flags] : empty_flags
      }
    end

    def empty_flags
      {
        "check" => false,
        "checkmate" => false,
        "capture" => false,
        "castling" => false,
        "promotion" => false
      }
    end

    def clean_eval(evaluation)
      {type: evaluation[:type], value: evaluation[:value]}
    end

    def eval_bar(evaluation)
      white = if evaluation[:type].to_s == "mate"
        evaluation[:value].to_i.positive? ? 98 : 2
      else
        (50 + evaluation[:value].to_i / 20).clamp(2, 98)
      end
      {white: white, black: 100 - white}
    end
  end
end
