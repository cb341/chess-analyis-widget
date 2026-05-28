# frozen_string_literal: true

# Chess contains plain Ruby services for parsing, replaying, evaluating, and
# rendering chess games for the analysis proof of concept.
module Chess
  # Parses PGN headers and strips move text down to ordered SAN tokens.
  class PgnParser
    RESULT_MARKERS = %w[1-0 0-1 1/2-1/2 *].freeze

    def parse(pgn)
      raise ArgumentError, "PGN is blank" if pgn.to_s.strip.empty?

      metadata = {}
      body_lines = []

      pgn.each_line do |line|
        if line =~ /^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/
          metadata[$1] = $2.gsub('\"', '"')
        else
          body_lines << line
        end
      end

      moves = extract_moves(body_lines.join(" "))
      raise ArgumentError, "PGN does not contain any moves" if moves.empty?

      {metadata: metadata, moves: moves}
    end

    private

    def extract_moves(text)
      cleaned = text.dup
      cleaned.gsub!(/\{[^}]*\}/m, " ")
      cleaned.gsub!(/;[^\n\r]*/, " ")
      cleaned.gsub!(/\([^()]*\)/, " ") while cleaned =~ /\([^()]*\)/
      cleaned.gsub!(/\$\d+/, " ")
      cleaned.gsub!(/\d+\.(\.\.)?/, " ")
      cleaned.gsub!(/\s+/, " ")

      cleaned.split(" ").reject do |token|
        RESULT_MARKERS.include?(token) || token.strip.empty?
      end
    end
  end
end
