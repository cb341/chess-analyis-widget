# frozen_string_literal: true

require "strscan"

module Chess
  # Extracts PGN tag-pair metadata and ordered SAN move tokens.
  #
  # Comments, NAGs, variations, move numbers, and result markers are removed so
  # downstream services can replay a single main line.
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

      {metadata: metadata, moves: moves.map { |m| m[:san] }, move_comments: moves.map { |m| m[:comment] }}
    end

    private

    def extract_moves(text)
      tokens = []
      pending_comment = nil

      # Strip line comments
      cleaned = text.gsub(/;[^\n\r]*/, " ")

      # Tokenize: extract {comments}, skip variations, collect move tokens
      scanner = StringScanner.new(cleaned)
      until scanner.eos?
        if scanner.scan(/\{([^}]*)\}/m)
          pending_comment = scanner[1].strip
        elsif scanner.scan("(")
          depth = 1
          until depth == 0 || scanner.eos?
            if scanner.scan("(")
              depth += 1
            elsif scanner.scan(")")
              depth -= 1
            else
              scanner.getch
            end
          end
        elsif scanner.scan(/\$\d+/)
          # NAG, skip
        elsif scanner.scan(/\d+\.\.\./)
          # black move number, skip
        elsif scanner.scan(/\d+\./)
          # move number, skip
        elsif scanner.scan(/\s+/)
          # whitespace, skip
        elsif scanner.scan(/(\S+)/)
          token = scanner[1]
          next if RESULT_MARKERS.include?(token)
          tokens << {san: token, comment: pending_comment}
          pending_comment = nil
        end
      end

      tokens
    end
  end
end
