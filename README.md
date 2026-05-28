# Chess Analysis Widget

Monorepo for a small chess analysis proof of concept.

## Projects

- `analysis-app/` - Rails-style Ruby app responsible for PGN parsing, board replay, Stockfish integration, move annotations, text analysis, and widget payload generation.
- `widget-demo/` - static no-build demo for `<chess-widget>`, using embedded analyzed JSON only.

## System Overview

The important split is ownership: the server is allowed to understand chess, call
Stockfish, and prepare complete positions. The widget is intentionally boring: it
renders precomputed state and never asks the network for more data.

```mermaid
flowchart LR
    Author[Author pastes PGN] --> App[analysis-app]
    App --> Parser[PGN parser]
    Parser --> Replay[Board replay]
    Replay --> Fen[FEN snapshots]
    Fen --> Engine[Stockfish 18]
    Engine --> Classifier[Move classifier]
    Replay --> Payload[Widget-ready JSON]
    Classifier --> Payload
    Payload --> Text[Unicode text analysis]
    Payload --> Page[Rendered HTML page]
    Page --> Widget[chess-widget]
    Widget --> Reader[Reader steps through game]

    Widget -. no fetch, no PGN parsing .-> Reader
```

```mermaid
flowchart TB
    subgraph Monorepo
        Specs[app_spec.md + widget_spec.md + features]
        subgraph AnalysisApp[analysis-app]
            Ruby[Plain Ruby services]
            Server[WEBrick/Rails-style controller]
            Docker[Dockerfile]
        end
        subgraph WidgetDemo[widget-demo]
            HTML[index.html]
            JS[chess-widget.js]
            CSS[chess-widget.css]
        end
    end

    Docker --> Stockfish[Stockfish 18 binary]
    Ruby --> Server
    Server --> JS
    Specs -. guides .-> AnalysisApp
    Specs -. guides .-> WidgetDemo
```

```mermaid
sequenceDiagram
    participant User
    participant Server as analysis-app
    participant Stockfish as Stockfish 18
    participant DOM as HTML document
    participant Widget as chess-widget

    User->>Server: Submit PGN
    Server->>Server: Parse headers and SAN moves
    Server->>Server: Replay moves into board snapshots
    Server->>Stockfish: Evaluate FEN positions
    Stockfish-->>Server: Centipawn or mate scores
    Server->>Server: Classify moves and render text analysis
    Server-->>DOM: HTML with embedded JSON
    Widget->>DOM: Read script[type=application/json]
    Widget->>Widget: Render board, move list, eval bar
    User->>Widget: Next / previous / keyboard
```

## Run With Docker

The Docker image downloads the official Stockfish 18 Linux x86-64 AVX2 release
asset and exposes it at `/usr/local/bin/stockfish`.

```sh
docker compose up --build analysis-app
```

Open:

```text
http://localhost:3000
```

The compose service uses `platform: linux/amd64` so the Stockfish 18 binary works
consistently, including on Apple Silicon through Docker emulation.

## Testing

```sh
docker compose run --rm analysis-app ruby script/check_sample
docker compose run --rm analysis-app ruby -c app/services/chess/stockfish_analyzer.rb
node --check widget-demo/chess-widget.js
```

High-level Cucumber specs live in `features/`. They document the intended
behavior but do not yet have step definitions:

```text
features/analysis_app.feature
features/widget.feature
```

Without Docker, the Ruby app still runs with a material-evaluation fallback if
`stockfish` is not installed locally.

## Architecture

The server is the analysis layer. It receives PGN, produces board snapshots, invented or Stockfish-backed evaluations, annotations, a text analysis, and a widget-ready JSON payload.

The widget is the presentation layer. It makes no API calls and does not parse PGN or run chess analysis.
