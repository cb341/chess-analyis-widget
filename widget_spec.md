# Chess Widget Spec

## Goal

Build a no-dependency, no-build-step chess analysis widget as a native custom element.

The widget renders a precomputed analyzed chess game. It does not parse PGN, does not validate moves, does not run analysis, and does not make network calls.

## Element

```html
<chess-widget data-source="game-data"></chess-widget>

<script type="application/json" id="game-data">
  {}
</script>

<link rel="stylesheet" href="/chess-widget.css" />
<script src="/chess-widget.js"></script>
```

The custom element name is:

```text
chess-widget
```

The JavaScript class may be named:

```js
class ChessWidget extends HTMLElement
```

## Hard Constraints

- No npm packages.
- No bundler.
- No transpiler.
- No framework.
- No imports.
- No `fetch`.
- No `XMLHttpRequest`.
- No `WebSocket`.
- No `EventSource`.
- No PGN parsing.
- No chess rule validation.
- No Stockfish or WASM engine.

The widget only reads JSON already present in the DOM.

## Files

```text
public/chess-widget.js
public/chess-widget.css
public/pieces/
  white-king.svg
  white-queen.svg
  white-rook.svg
  white-bishop.svg
  white-knight.svg
  white-pawn.svg
  black-king.svg
  black-queen.svg
  black-rook.svg
  black-bishop.svg
  black-knight.svg
  black-pawn.svg
```

If SVG files are not ready, the POC may render Unicode chess symbols.

## Data Loading

Primary loading mode:

```html
<chess-widget data-source="game-data"></chess-widget>
```

The widget finds:

```js
document.getElementById(this.dataset.source);
```

Then parses:

```js
JSON.parse(source.textContent);
```

Optional JS API:

```js
document.querySelector("chess-widget").load(gameData);
```

The JS API is useful for tests and local demos, but the Rails-rendered page should use embedded JSON.

## Input Payload

The widget expects the app payload defined in `app_spec.md`.

Minimum required fields:

```json
{
  "version": 1,
  "metadata": {},
  "summary": "",
  "positions": [
    {
      "ply": 0,
      "board": {},
      "last_move": null,
      "annotation": null,
      "eval_bar": {
        "white": 50,
        "black": 50
      },
      "flags": {}
    }
  ],
  "moves": []
}
```

The widget should tolerate missing optional fields by rendering empty/default UI.

## Rendering

The widget renders:

- header with player names and result
- board
- previous button
- next button
- move counter
- current move SAN
- current annotation
- evaluation bar
- summary text
- move list

The first visible state is ply 0, the starting position.

## Board

Use CSS grid:

```css
.cw-board {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
}
```

Square coordinates:

```text
a8 b8 c8 d8 e8 f8 g8 h8
a7 b7 c7 d7 e7 f7 g7 h7
...
a1 b1 c1 d1 e1 f1 g1 h1
```

Default orientation is White at the bottom.

Future option:

```html
<chess-widget orientation="black"></chess-widget>
```

## Visual Style

Target style:

- newspaper-like board
- restrained colors
- clear annotations
- simple modern pieces
- chess.com-inspired interaction, but not a clone

Suggested colors:

```css
--cw-paper: #f4f0e6;
--cw-ink: #181614;
--cw-light-square: #eee5d2;
--cw-dark-square: #8f846f;
--cw-highlight: #d9b44a;
--cw-good: #4f8f5b;
--cw-mistake: #d89c2b;
--cw-blunder: #bd3b3b;
--cw-brilliant: #2d9cdb;
--cw-checkmate: #181614;
```

## Piece Rendering

POC option:

```js
const PIECES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
  P: "♙",
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};
```

Later option:

```html
<img src="/pieces/white-king.svg" alt="" />
```

Use `aria-label` on pieces or squares where practical.

## Controls

Buttons:

```text
previous
next
```

Keyboard support:

```text
ArrowLeft  previous move
ArrowRight next move
Home       start
End        final position
```

Buttons must be disabled at the bounds:

```text
previous disabled at ply 0
next disabled at final ply
```

## Move List

Render moves in chess notation pairs:

```text
1. e4 d5
2. Nf3 dxe4
```

Each move should show a compact annotation mark:

```text
good       no mark or small dot
mistake    ?
blunder    ??
brilliant  !!
checkmate  #
```

Clicking a move jumps to that ply.

## Annotation Overlay

On each ply, if an annotation exists, show an overlay near the board:

```text
Good move
Mistake
Blunder
Brilliant
Checkmate
```

Overlay class names:

```text
cw-annotation-good
cw-annotation-mistake
cw-annotation-blunder
cw-annotation-brilliant
cw-annotation-checkmate
```

## Last Move Highlight

If `position.last_move` is present:

```json
{
  "from": "e2",
  "to": "e4"
}
```

Highlight both source and destination squares.

## Evaluation Bar

Render a vertical bar beside the board.

Input:

```json
{
  "white": 62,
  "black": 38
}
```

Display:

```text
White share at bottom
Black share at top
```

Clamp values to `0..100` defensively.

## Animation

POC animation:

- On ply change, fade moved piece or briefly scale destination square.
- Highlight source and destination.

Later animation:

- Animate piece translation from source square to destination square.

The widget must remain usable if animations are disabled by the browser or user preferences.

Respect:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

## Sound

Sound is optional and off by default.

Future attribute:

```html
<chess-widget sound="on"></chess-widget>
```

For POC, skip sound unless everything else is working.

## Accessibility

Minimum:

- focusable widget container
- keyboard navigation
- buttons with text labels
- no color-only annotation dependency
- visible focus states
- board state announced in compact text when move changes

Use:

```html
<div aria-live="polite"></div>
```

for current move text.

## Error Handling

If the source element is missing:

```text
Unable to load chess data.
```

If JSON parsing fails:

```text
Invalid chess data.
```

If positions are missing or empty:

```text
No chess positions available.
```

Errors should render inside the element and should not throw uncaught exceptions.

## Public Methods

```js
load(gameData);
goTo(ply);
next();
previous();
start();
end();
```

These methods update the DOM immediately.

## Internal State

```js
{
  game: null,
  currentPly: 0
}
```

Current position:

```js
this.game.positions[this.currentPly];
```

## Implementation Sketch

```js
(function () {
  class ChessWidget extends HTMLElement {
    connectedCallback() {
      this.currentPly = 0;
      this.setAttribute("tabindex", "0");
      this.bindKeyboard();
      this.loadFromSource();
    }

    loadFromSource() {
      var sourceId = this.getAttribute("data-source");
      var source = sourceId && document.getElementById(sourceId);

      if (!source) {
        this.renderError("Unable to load chess data.");
        return;
      }

      try {
        this.load(JSON.parse(source.textContent));
      } catch (error) {
        this.renderError("Invalid chess data.");
      }
    }

    load(gameData) {
      this.game = gameData;
      this.currentPly = 0;
      this.render();
    }
  }

  customElements.define("chess-widget", ChessWidget);
})();
```

## POC Acceptance Criteria

The widget should:

- load from embedded JSON
- make no API calls
- render the starting board
- step forward and backward through all positions
- disable controls at the start and end
- highlight the last move
- show annotation overlay
- show evaluation bar
- render move list
- jump when a move is clicked
- support keyboard left/right navigation
- handle bad/missing JSON gracefully
