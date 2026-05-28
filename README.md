# Chess Widget

A static, client-only PGN replay widget for GitHub Pages. It parses PGN in the browser, rebuilds board positions from SAN, and reads evaluations from lichess `[%eval]` comments already present in the PGN.

No server, Stockfish, database, build step, or precomputed JSON is required.

## Usage

```html
<link rel="stylesheet" href="./chess-widget.css">

<chess-widget src="/assets/games/blitz-checkmate.pgn" eval-chart clocks>
  <a href="https://cb341.dev/blog/chess-widget-did-not-need-a-server/">See the annotated game on the site</a>
</chess-widget>

<script src="./chess-widget.js"></script>
```

Inline PGN also works:

```html
<chess-widget pgn='[White "Ada"] [Black "Grace"] 1. e4 { [%eval 0.20] } e5'></chess-widget>
```

## Attributes

- `pgn`: raw PGN text.
- `src`: URL to a raw `.pgn` file.
- `start`: first allowed ply, using 0-based half moves. Default is `0`.
- `end`: last allowed ply. Default is the end of the game.
- `ply`: initial ply. Default is `start`.
- `move` and `side`: optional move lookup, for example `move="16" side="white"`.
- `orientation`: `white` or `black`. Default is `white`.
- `eval-chart`: show an evaluation chart when the PGN has `[%eval]`.
- `clocks`: show per-side remaining time from `[%clk]`.
- `sound`: play move sounds. Default is off.

The widget supports previous, next, move-list seeking, and arrow-key navigation when focused. Multiple widgets on one page are independent.

## PGN Support

The parser handles tag pairs, `[SetUp "1"]` plus `[FEN "..."]`, SAN moves, captures, castling, promotion, disambiguation, checks, mates, en passant, comments, clocks, evals, and common NAG glyphs.

Per ply, it keeps the SAN, side, board position, comment text, eval value or mate flag, clock, and glyph.

## Lichess Eval Workflow

1. Get the game PGN from wherever you played. On chess.com, use Download or Share, then PGN. That PGN has moves and clocks but no eval, which is normal. chess.com does not export eval.
2. Go to `lichess.org/paste`, paste the PGN, import it, then request Computer analysis. Stockfish runs on lichess servers. lichess accepts any PGN. The game does not need to be played there.
3. Export the analyzed PGN. lichess writes `{ [%eval 0.24] }`, mate as `{ [%eval #3] }`, and clocks as `{ [%clk 0:05:00] }`.
4. Paste into the widget. The chart is built from `[%eval]`. No engine runs in the widget. A PGN with no `[%eval]`, such as a raw chess.com export, still replays fine. It just shows no chart.

## CSS Variables

The included styles define a complete default theme. Override variables on `chess-widget`:

```css
chess-widget {
  --cw-paper: #fff;
  --cw-ink: #222;
  --cw-line: #c7c7c7;
  --cw-light-square: #f0d9b5;
  --cw-dark-square: #b58863;
  --cw-board-max-width: 560px;
}
```

See `demo.html` and `assets/games/blitz-checkmate.pgn` for a complete static page.
