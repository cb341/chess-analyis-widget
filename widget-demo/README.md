# Widget Demo

Static no-build demo for `<chess-widget>`.

## Run

Open directly in a browser:

```text
widget-demo/index.html
```

No server, package install, or build step is required.

## Testing

```sh
node --check widget-demo/chess-widget.js
bunx eslint widget-demo
bin/lint
```

The widget reads only embedded JSON from the DOM and makes no API calls.
