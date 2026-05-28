# Chess Analysis App Spec

## Goal

Build a simple Ruby on Rails proof of concept that accepts a PGN game, analyzes it with Stockfish 18, and renders a complete analyzed game payload into the page for a static widget.

The app is responsible for all chess understanding and analysis. The browser widget is only a renderer.

The server should also be able to render the analysis as standalone text using Unicode chess pieces, compact move annotations, and an evaluation bar.

## Non-Goals

- No client-side chess engine.
- No widget API calls.
- No frontend build step.
- No JavaScript dependencies.
- No full chess.com clone.
- No user accounts for the POC.
- No background jobs for the first version unless request time becomes unacceptable.

## User Flow

1. User opens the Rails app.
2. User pastes a PGN into a textarea.
3. User submits the form.
4. Rails parses the PGN headers and moves.
5. Rails replays the game and records every board state.
6. Rails evaluates positions with local Stockfish 18.
7. Rails classifies moves.
8. Rails generates a short summary.
9. Rails renders a page containing:
   - summary text
   - optional text analysis
   - raw analyzed JSON in a `<script type="application/json">` tag
   - `<chess-widget data-source="...">`
   - static widget CSS/JS files

## Routes

```ruby
root "analyses#new"

resources :analyses, only: [:new, :create, :show]
```

For the POC, `create` analyzes inline, upserts the deterministic analysis
record, and redirects to `show`.

Admin routes:

```ruby
get "/admin/", to: "admin/analyses#index"

namespace :admin do
  root "analyses#index"
  resources :analyses, only: [:index, :show]
end
```

## Data Model

### Analysis

```text
id
pgn:text
payload:json
created_at
updated_at
```

`payload` contains the full widget-ready analyzed game.

### Optional Future Model: AnalyzedMove

Only add this if querying individual moves becomes useful.

```text
analysis_id
ply:integer
move_number:integer
color:string
san:string
from_square:string
to_square:string
annotation:string
eval_before:integer
eval_after:integer
eval_loss:integer
flags:json
fen_before:text
fen_after:text
```

For the POC, storing this inside `Analysis#payload` is enough.

### Chess Value Objects

The analysis pipeline should prefer concrete model/value objects over anonymous
hash and string manipulation at important boundaries.

```text
app/models/chess/fen_position.rb
app/models/chess/castling_rights.rb
app/models/chess/evaluation.rb
app/models/chess/eval_bar.rb
```

`Chess::FenPosition` declares:

```text
piece_placement
active_color
castling_availability
en_passant_target
halfmove_clock
fullmove_number
```

`Chess::Evaluation` declares the Stockfish/fallback schema:

```ruby
{
  type: "cp" | "mate",
  value: Integer,
  source: "stockfish" | "fallback_material"
}
```

`Chess::EvalBar` declares the widget split:

```ruby
{
  white: Integer,
  black: Integer
}
```

with `white + black == 100`.

## Services

```text
app/services/chess/pgn_parser.rb
app/services/chess/board.rb
app/services/chess/move_resolver.rb
app/services/chess/fen_builder.rb
app/services/chess/stockfish_analyzer.rb
app/services/chess/move_classifier.rb
app/services/chess/summary_builder.rb
app/services/chess/text_analysis_renderer.rb
app/services/chess/markdown_analysis_renderer.rb
app/services/chess/analysis_builder.rb
```

### Chess::PgnParser

Responsibilities:

- Parse PGN header tags.
- Extract SAN move text.
- Remove comments, NAGs, and result markers.
- Return ordered SAN moves.

Input:

```ruby
pgn: String
```

Output:

```ruby
{
  metadata: {
    "Event" => "Live Chess",
    "Site" => "Chess.com",
    "White" => "CuddlyBunion341",
    "Black" => "KamKam777",
    "Result" => "1-0"
  },
  moves: ["e4", "d5", "Nf3"]
}
```

### Chess::Board

Responsibilities:

- Hold current board state.
- Track turn, castling availability, en passant target, halfmove clock, and fullmove number.
- Apply already-resolved moves.
- Produce serializable board snapshots.

Board representation should be simple:

```ruby
{
  "a1" => "R",
  "b1" => "N",
  "e8" => "k"
}
```

Piece notation:

```text
White: K Q R B N P
Black: k q r b n p
```

### Chess::MoveResolver

Responsibilities:

- Convert SAN moves into concrete moves.
- Resolve source and destination squares.
- Detect captures, castling, promotion, check, and checkmate markers.
- Handle disambiguation such as `Nbd2`, `R1e1`, `Qh5+`.

POC support must include:

- normal piece moves
- pawn moves
- captures
- check
- checkmate
- kingside and queenside castling
- basic promotion
- SAN disambiguation

En passant may be added after the initial happy-path PGN works.

### Chess::FenBuilder

Responsibilities:

- Generate FEN before and after every move through `Chess::FenPosition`.
- Include active color, castling availability, en passant target, halfmove clock, and fullmove number.

Stockfish must receive valid FEN.

### Chess::StockfishAnalyzer

Responsibilities:

- Start local Stockfish 18.
- Send UCI commands.
- Evaluate each FEN at a configured depth.
- Return centipawn or mate score.
- Enforce timeout per position.

Initial settings:

```text
depth: 10
threads: 1
hash: 64 MB
```

Expected normalized output:

```ruby
{
  type: "cp",
  value: 42,
  source: "stockfish"
}
```

or:

```ruby
{
  type: "mate",
  value: 3,
  source: "stockfish"
}
```

Evaluation should be normalized from White's perspective:

```text
positive = White is better
negative = Black is better
```

This invariant is validated in `Chess::EvaluationSchema`. Fallback material
evaluation uses the same schema with `source: "fallback_material"`.

### Chess::MoveClassifier

Responsibilities:

- Compare evaluation before and after each move.
- Classify the move from the mover's perspective.
- Return one of the POC labels:
  - `brilliant`
  - `good`
  - `mistake`
  - `blunder`
  - `checkmate`

Initial centipawn thresholds:

```text
0..50 cp loss      good
51..150 cp loss    mistake
151+ cp loss       blunder
mate delivered     checkmate
```

`brilliant` should be conservative. For the POC, it may be omitted or only assigned when:

- the move improves the mover's evaluation by at least 150 cp
- the move is a sacrifice or forcing tactical move
- the position is not already trivially winning

### Chess::SummaryBuilder

Responsibilities:

- Produce short human-readable text from the analyzed move list.
- Mention important state changes:
  - castling
  - checks
  - checkmate
  - major blunders
  - large material swings
  - final result

Example:

```text
White castled on move 11. White won material after 17. Qxe5+. The game ended with 23. Rd8# checkmate.
```

### Chess::TextAnalysisRenderer

Responsibilities:

- Render a standalone text version of the analysis on the server.
- Use Unicode chess pieces where useful.
- Use compact chess-style annotation marks.
- Include an evaluation bar after each move or move pair.
- Require no JavaScript.
- Render from the same analyzed payload used by the widget.

This renderer is useful for:

- debugging analysis quality
- copying analysis into notes
- rendering a simple no-widget fallback
- showing analysis in terminals or plain HTML `<pre>` blocks

Example output:

```text
CuddlyBunion341 (204) vs KamKam777 (185)
Result: 1-0

1. ♙e4 !      ♟d5 ?!
   Eval: White [██████████░░░░░░░░░░] Black +0.3

2. ♘f3 !      ♟dxe4 ?
   Eval: White [█████████░░░░░░░░░░░] Black -0.1

...

23. ♖d8# !!
    Eval: White [███████████████████░] Black Mate
```

The exact spacing can be refined during implementation, but the format should remain readable in monospace text.

Piece symbols:

```text
White: ♔ ♕ ♖ ♗ ♘ ♙
Black: ♚ ♛ ♜ ♝ ♞ ♟
```

Annotation marks:

```text
brilliant  !!
good       !
mistake    ?!
blunder    ??
checkmate  #
```

If a move is checkmate and brilliant/good by classification, checkmate should still be visible through the SAN `#`, for example:

```text
♖d8# !!
```

Evaluation bar text format:

```text
Eval: White [████████████░░░░░░░░] Black +1.2
```

Rules:

- 20 total bar cells.
- Filled cells represent White's share.
- Empty cells represent Black's share.
- Centipawn values display as pawns with one decimal place.
- Mate values display as `Mate`, `White mate`, `Black mate`, or `M3` where useful.

Fallback ASCII mode may be added later, but Unicode is the default.

### Chess::MarkdownAnalysisRenderer

Responsibilities:

- Render a Markdown response type on the server.
- Use Unicode chess pieces in SAN-like move notation.
- Use compact annotations such as `!`, `?!`, `??`, and `!!`.
- Include an evaluation bar per move pair.
- Render from the same analyzed payload used by the widget.

Example output:

```markdown
# CuddlyBunion341 (204) vs KamKam777 (185)

- **Result:** 1-0
- **Summary:** White castled on move 11. The game ended with 23. Rd8# checkmate.

| Move | White     | Black      | Eval                    |
| ---: | --------- | ---------- | ----------------------- |
|    1 | **♙e4** ! | **♟d5** ?! | `W [█████░░░░░] B +0.3` |
```

The Markdown response is intended for copying into notes, posts, or documents.

### Chess::AnalysisBuilder

Orchestrates the full flow:

```text
PGN -> parsed moves -> board snapshots -> FENs -> Stockfish evals -> annotations -> summary -> widget payload
```

## Widget Payload

Rails must emit a complete payload. The widget must not derive chess rules from PGN.

```json
{
  "version": 1,
  "metadata": {
    "Event": "Live Chess",
    "Site": "Chess.com",
    "Date": "2026.05.27",
    "White": "CuddlyBunion341",
    "Black": "KamKam777",
    "Result": "1-0",
    "WhiteElo": "204",
    "BlackElo": "185",
    "Termination": "CuddlyBunion341 won by checkmate"
  },
  "summary": "White castled on move 11. The game ended with 23. Rd8# checkmate.",
  "text_analysis": "CuddlyBunion341 (204) vs KamKam777 (185)\nResult: 1-0\n\n1. ♙e4 !      ♟d5 ?!\n   Eval: White [██████████░░░░░░░░░░] Black +0.3",
  "markdown_analysis": "# CuddlyBunion341 (204) vs KamKam777 (185)\n\n| Move | White | Black | Eval |\n| ---: | --- | --- | --- |\n| 1 | **♙e4** ! | **♟d5** ?! | `W [█████░░░░░] B +0.3` |",
  "positions": [
    {
      "ply": 0,
      "move_number": 0,
      "color": null,
      "san": null,
      "board": {
        "a1": "R",
        "b1": "N"
      },
      "last_move": null,
      "annotation": null,
      "eval": {
        "type": "cp",
        "value": 0,
        "source": "fallback_material"
      },
      "eval_bar": {
        "white": 50,
        "black": 50
      },
      "flags": {
        "check": false,
        "checkmate": false,
        "capture": false,
        "castling": false,
        "promotion": false
      }
    }
  ],
  "moves": [
    {
      "ply": 1,
      "move_number": 1,
      "color": "white",
      "san": "e4",
      "from": "e2",
      "to": "e4",
      "piece": "P",
      "captured": null,
      "promotion": null,
      "annotation": "good",
      "eval_before": {
        "type": "cp",
        "value": 0,
        "source": "fallback_material"
      },
      "eval_after": {
        "type": "cp",
        "value": 22,
        "source": "fallback_material"
      },
      "eval_loss": 0,
      "flags": {
        "check": false,
        "checkmate": false,
        "capture": false,
        "castling": false,
        "promotion": false
      }
    }
  ]
}
```

## Evaluation Bar

The bar is a visual winning-chance approximation, not literal player ELO.

Initial conversion:

```text
clamp centipawn eval to [-1000, 1000]
white percentage = 50 + eval / 20
black percentage = 100 - white percentage
```

Mate scores should map near the edge:

```text
mate for White: white 98, black 2
mate for Black: white 2, black 98
```

The same evaluation data should drive both:

- widget visual evaluation bar
- server-rendered text evaluation bar

## Error Handling

The app should show a readable error when:

- PGN is blank.
- PGN cannot be parsed.
- A SAN move cannot be resolved.
- Stockfish is missing.
- Stockfish times out.

Errors should include the move number when possible.

## Testing Priorities

1. PGN header parsing.
2. SAN move extraction.
3. Move resolution for the sample game.
4. Castling detection.
5. Check and checkmate flags.
6. FEN generation.
7. Move classification thresholds.
8. Payload shape.

## POC Acceptance Criteria

Given the sample PGN in `PROMPT.md`, the app should:

- parse all metadata headers
- replay the full game
- generate a board position for every ply including ply 0
- detect `11. O-O` as castling
- detect checking moves with `+`
- detect `23. Rd8#` as checkmate
- classify every move as one of the POC annotations
- produce an evaluation bar value for every position
- produce a server-rendered text analysis with Unicode pieces, `??`, `?!`, `!`, `!!`, and text eval bars
- produce a server-rendered Markdown analysis with Unicode pieces and compact annotations
- render a page where the static widget can step through the game without API calls
