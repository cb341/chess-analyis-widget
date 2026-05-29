# Chess Widget

A static, client-only PGN replay widget for GitHub Pages. It parses PGN in the browser, rebuilds board positions from SAN, and reads evaluations from lichess `[%eval]` comments already present in the PGN.

No server, Stockfish, database, build step, or precomputed JSON is required.

## Usage

```html
<link rel="stylesheet" href="./chess-widget.css">

<chess-widget src="/assets/games/blitz-checkmate.pgn" eval-chart clocks>
  <a href="https://cb341.dev/blog/chess-widget-did-not-need-a-server/">Enable JavaScript to show widget</a>
</chess-widget>

<script src="./chess-pgn.js"></script>
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
- `eval-bar`: show the vertical evaluation bar. Set `eval-bar="false"` to hide it.
- `clocks`: show per-side remaining time from `[%clk]`.
- `sound`: play move, capture, check, mate, and annotation sounds. Default is off.
- `sound-move`, `sound-capture`, `sound-check`, `sound-checkmate`, `sound-castle`, `sound-blunder`, `sound-mistake`, `sound-brilliant`, `sound-good`: override individual sound file URLs.
- `header`: set `header="false"` to hide the title and player row.
- `controls`: set `controls="false"` to hide previous and next controls.
- `comments`: set `comments="false"` to hide the current move annotation.
- `moves`: set `moves="false"` to hide the move list.
- `move-badges`: show `??`, `?`, and `!!` badges on the moved piece. Set `move-badges="false"` to hide them.
- `badge-blunder`, `badge-mistake`, `badge-brilliant`: override badge labels.
- `minimal`: shortcut for board plus controls only.
- `board-only`: shortcut for board only. Arrow keys still work when focused.

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

The included styles define a complete default theme. Override variables on `chess-widget` rather than editing the bundled CSS:

```css
chess-widget {
  --cw-paper: #fff;
  --cw-ink: #222;
  --cw-line: #c7c7c7;
  --cw-light-square: #f0d9b5;
  --cw-dark-square: #b58863;
  --cw-board-max-width: 560px;
  --cw-main-gap: 24px;
  --cw-piece-arrive-animation: 420ms ease;
  --cw-control-border: 1px solid #444;
}
```

Common extension variables include:

- `--cw-board-max-width`, `--cw-board-width-small`
- `--cw-main-columns`, `--cw-main-gap`, `--cw-shell-gap`
- `--cw-control-border`, `--cw-control-font-size`, `--cw-control-min-height`
- `--cw-piece-padding`, `--cw-piece-arrive-animation`, `--cw-piece-spawn-animation`
- `--cw-piece-badge-font-size`, `--cw-piece-badge-shift-x`, `--cw-piece-badge-shift-y`, `--cw-piece-badge-outline`, `--cw-piece-badge-blunder`, `--cw-piece-badge-mistake`, `--cw-piece-badge-brilliant`
- `--cw-placeholder-board-width`, `--cw-placeholder-min-height`, `--cw-placeholder-opacity`
- `--cw-chart-height`, `--cw-eval-width`, `--cw-move-list-max-height`

## Events

The element dispatches bubbling custom events:

- `chess-widget:load`: PGN parsed and game state is ready.
- `chess-widget:error`: parsing or loading failed.
- `chess-widget:beforemove`: cancelable. Call `event.preventDefault()` to block navigation.
- `chess-widget:move`: navigation completed.
- `chess-widget:render`: DOM was rendered for the current ply.

```js
document.querySelector("chess-widget").addEventListener("chess-widget:move", (event) => {
  console.log(event.detail.from, event.detail.to, event.detail.move);
});
```

For non-DOM integration, the parser is also exposed as:

```js
const parsed = window.ChessPgn.parse(pgn);
const game = customElements.get("chess-widget").parsePgn(pgn);
```

See `index.html` and `assets/games/blitz-checkmate.pgn` for a complete static page.
