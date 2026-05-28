# frozen_string_literal: true

require "open3"
require "timeout"
require_relative "../../../config/application"
require_relative "evaluation_schema"

module Chess
  # Evaluates FEN positions through a local Stockfish UCI executable.
  #
  # If Stockfish is unavailable or times out, the analyzer falls back to a
  # deterministic material count so the rest of the app remains usable in local
  # development and tests.
  class StockfishAnalyzer
    PIECE_VALUES = {
      "P" => 100, "N" => 320, "B" => 330, "R" => 500, "Q" => 900, "K" => 0,
      "p" => -100, "n" => -320, "b" => -330, "r" => -500, "q" => -900, "k" => 0
    }.freeze

    def initialize(
      path: ENV["STOCKFISH_PATH"] || "stockfish",
      depth: nil,
      timeout: nil
    )
      @path = path
      @depth = Integer(depth || ENV.fetch("STOCKFISH_DEPTH", "10"))
      @timeout = Float(timeout || ENV.fetch("STOCKFISH_TIMEOUT", "2.0"))
      @available = executable_available?
    end

    def available?
      @available
    end

    def version
      return nil unless available?

      @version ||= detect_version_from_uci
    end

    def evaluate_fen(fen, board: nil)
      unless available?
        AnalysisApp.logger.debug("stockfish unavailable; using fallback fen=#{fen}")
        return validate(fallback_evaluation(board, fen), "fallback evaluation")
      end

      AnalysisApp.logger.debug("stockfish evaluate depth=#{depth} fen=#{fen}")
      validate(stockfish_evaluation(fen), "stockfish evaluation")
    rescue => error
      AnalysisApp.logger.warn("stockfish failed; using fallback class=#{error.class} message=#{error.message}")
      validate(fallback_evaluation(board, fen), "fallback evaluation")
    end

    private

    attr_reader :path, :depth, :timeout

    def detect_version_from_uci
      Timeout.timeout(2) do
        Open3.popen3(path) do |stdin, stdout, stderr, _|
          stderr.close
          stdin.puts "uci"
          stdout.each_line do |line|
            return line.strip.sub(/^id name /, "") if line.start_with?("id name")
            break if line.strip == "uciok"
          end
          stdin.puts "quit"
        end
      end
      nil
    rescue
      nil
    end

    def validate(evaluation, context)
      EvaluationSchema.validate!(evaluation, context: context)
    end

    def executable_available?
      return File.executable?(path) if path.include?("/")

      ENV.fetch("PATH", "").split(File::PATH_SEPARATOR).any? do |dir|
        File.executable?(File.join(dir, path))
      end
    end

    def stockfish_evaluation(fen)
      best_score = nil

      Timeout.timeout(timeout) do
        Open3.popen3(path) do |stdin, stdout, stderr, wait_thread|
          stderr.close
          configure_engine(stdin, stdout)
          stdin.puts "ucinewgame"
          stdin.puts "position fen #{fen}"
          stdin.puts "go depth #{depth}"

          stdout.each_line do |line|
            best_score = parse_score(line, active_color(fen)) || best_score
            break if line.start_with?("bestmove")
          end

          stdin.puts "quit"
          wait_thread.value
        ensure
          stdin&.close unless stdin&.closed?
        end
      end

      best_score || raise("Stockfish returned no score")
    end

    def configure_engine(stdin, stdout)
      stdin.puts "uci"
      read_until(stdout, "uciok")
      stdin.puts "setoption name Threads value 1"
      stdin.puts "setoption name Hash value 64"
      stdin.puts "isready"
      read_until(stdout, "readyok")
    end

    def read_until(stdout, marker)
      stdout.each_line.any? { |line| line.strip == marker }
    end

    def parse_score(line, active_color)
      case line
      when /\bscore cp (-?\d+)/
        {type: "cp", value: normalize_score(Regexp.last_match(1).to_i, active_color), source: "stockfish"}
      when /\bscore mate (-?\d+)/
        {type: "mate", value: normalize_score(Regexp.last_match(1).to_i, active_color), source: "stockfish"}
      end
    end

    def active_color(fen)
      (fen.to_s.split[1] == "b") ? "black" : "white"
    end

    def normalize_score(value, active_color)
      (active_color == "black") ? -value : value
    end

    def fallback_evaluation(board, fen)
      value = board ? material_score(board) : material_from_fen(fen)
      {type: "cp", value: value, source: "fallback_material"}
    end

    def material_score(board)
      board.squares.values.inject(0) { |sum, piece| sum + PIECE_VALUES.fetch(piece, 0) }
    end

    def material_from_fen(fen)
      placement = fen.to_s.split.first.to_s
      placement.each_char.inject(0) { |sum, char| sum + PIECE_VALUES.fetch(char, 0) }
    end
  end
end
