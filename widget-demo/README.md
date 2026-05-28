# Widget Demo

Static no-build demo for `<chess-widget>`.

## Styles

- `chess-widget-base.css`: required layout, board grid, controls, and accessible hidden live region.
- `chess-widget-fancy.css`: newspaper board treatment, animated pieces, annotation markers, colors, shadows, and responsive polish.
- `chess-widget.css`: compatibility wrapper that imports both layers.

## Run

Open directly in a browser:

```text
widget-demo/index.html
```

No server, package install, or build step is required.

Move sounds are local MP3 assets in `assets/sounds`. They were downloaded from the open-source Lichess sound pack at <https://github.com/lichess-org/lila/tree/master/public/sound/standard> and are only played after user navigation.

## Testing

```sh
node --check widget-demo/chess-widget.js
bunx eslint widget-demo
bin/lint
```

The widget reads only embedded JSON from the DOM and makes no API calls.
