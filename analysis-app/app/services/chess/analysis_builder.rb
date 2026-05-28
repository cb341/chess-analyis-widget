# frozen_string_literal: true

require_relative "pgn_parser"
require_relative "../../../config/application"
require_relative "board"
require_relative "move_resolver"
require_relative "fen_builder"
require_relative "stockfish_analyzer"
require_relative "evaluation_schema"
require_relative "../../models/chess/eval_bar"
require_relative "move_classifier"
require_relative "summary_builder"
require_relative "text_analysis_renderer"
require_relative "markdown_analysis_renderer"

module Chess
  # Orchestrates PGN parsing, board replay, evaluation, annotation, and response
  # rendering into one payload for the UI and copyable analysis formats.
  class AnalysisBuilder
    PAYLOAD_VERSION = 1
    COLORS = %w[white black].freeze

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

    def build(pgn, progress: nil)
      report(progress, "Parsing PGN")
      parsed = @parser.parse(pgn)
      board = Board.new
      positions = []
      moves = []
      ply = 0
      report(progress, "Evaluating starting position")
      current_eval = evaluate(board)
      positions << position_payload(board, ply, 0, nil, nil, nil, current_eval)

      report(progress, "Replaying #{parsed[:moves].length} moves")
      parsed[:moves].each_with_index do |san, index|
        move_number = (index / 2) + 1
        color = board.current_color
        report(progress, "Analyzing #{move_number}. #{san} for #{color}")
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

      report(progress, "Rendering analysis output")
      payload = {
        version: PAYLOAD_VERSION,
        metadata: parsed[:metadata],
        summary: "",
        text_analysis: "",
        markdown_analysis: "",
        positions: positions,
        moves: moves,
        analyzer: {
          stockfish_available: @analyzer.available?,
          note: @analyzer.available? ? "Using Stockfish UCI evaluation" : "Using fallback material evaluator; annotations are approximate"
        }
      }
      payload[:summary] = @summary_builder.build(payload)
      payload[:text_analysis] = @text_renderer.render(payload)
      payload[:markdown_analysis] = @markdown_renderer.render(payload)
      validate_payload!(payload)
      report(progress, "Analysis complete")
      payload
    end

    private

    def report(progress, message)
      AnalysisApp.logger.debug("analysis_builder #{message}")
      progress&.call(message)
    end

    def evaluate(board)
      EvaluationSchema.validate!(@analyzer.evaluate_fen(@fen_builder.build(board), board: board))
    end

    def validate_payload!(payload)
      raise ArgumentError, "payload version must be #{PAYLOAD_VERSION}" unless payload[:version] == PAYLOAD_VERSION
      raise ArgumentError, "positions must include starting position" if payload[:positions].empty?
      raise ArgumentError, "positions must equal moves + 1" unless payload[:positions].length == payload[:moves].length + 1

      payload[:moves].each do |move|
        raise ArgumentError, "move color must be white or black" unless COLORS.include?(move[:color])

        EvaluationSchema.validate!(move[:eval_before], context: "move #{move[:ply]} eval_before")
        EvaluationSchema.validate!(move[:eval_after], context: "move #{move[:ply]} eval_after")
      end

      payload[:positions].each do |position|
        EvaluationSchema.validate!(position[:eval], context: "position #{position[:ply]} eval")
        EvalBar.new(position[:eval_bar]).validate!
      end
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
        annotation_detail: move ? {
          kind: move[:annotation],
          label: annotation_label(move[:annotation]),
          text: annotation_text(move)
        } : nil,
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
      EvaluationSchema.validate!(evaluation)
    end

    def eval_bar(evaluation)
      EvalBar.from_evaluation(Evaluation.from_hash(evaluation)).to_h
    end

    def annotation_label(kind)
      {
        "blunder" => "Blunder",
        "mistake" => "Mistake",
        "brilliant" => "Brilliant",
        "checkmate" => "Checkmate",
        "good" => "Good move"
      }.fetch(kind, "Good move")
    end

    def annotation_text(move)
      return "The game ends by checkmate." if move[:flags]["checkmate"]
      return "Large evaluation loss after this move." if move[:annotation] == "blunder"
      return "The move gives up part of the position." if move[:annotation] == "mistake"
      return "Stockfish sees a major tactical improvement." if move[:annotation] == "brilliant"

      "The move keeps the position playable."
    end
  end
end
