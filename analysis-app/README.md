# Chess Analysis App

This is a dependency-free Rails-style skeleton for the POC described in `../app_spec.md`.
Rails and Rack are not installed in the current environment, so the app keeps the
same broad layout while providing a small stdlib WEBrick runner.

## Docker Setup

From the repo root:

```sh
docker compose up --build analysis-app
```

Then open:

```text
http://localhost:3000
```

The image installs Stockfish 18 from the official `sf_18` GitHub release asset:

```text
stockfish-ubuntu-x86-64-avx2.tar
```

Compose sets:

```text
STOCKFISH_PATH=/usr/local/bin/stockfish
STOCKFISH_DEPTH=10
STOCKFISH_TIMEOUT=2.0
```

## Run Locally

```sh
cd analysis-app
ruby bin/server
```

Then open `http://localhost:3000`.

Run the sample payload check:

```sh
cd analysis-app
ruby script/check_sample
```

Local runs use real Stockfish when `stockfish` is on `PATH`; otherwise they use
the deterministic material fallback.

## Testing

From the repo root:

```sh
ruby analysis-app/script/check_sample
find analysis-app -type f \( -name '*.rb' -o -path 'analysis-app/bin/server' -o -path 'analysis-app/script/check_sample' \) -exec ruby -c {} \;
```

With Docker and Stockfish 18:

```sh
docker compose run --rm analysis-app ruby script/check_sample
docker compose run --rm analysis-app stockfish bench 1
```

## Service Entry Point

```ruby
require_relative "app/services/chess/analysis_builder"

payload = Chess::AnalysisBuilder.new.build(pgn)
```

The returned payload includes:

- parsed PGN metadata
- every board position from ply 0
- resolved moves with source and destination squares
- FEN before and after each move
- annotations
- evaluation bar data
- validated evaluation hashes: `{type:, value:, source:}`
- summary text
- `text_analysis`
- `markdown_analysis`

## Analysis Resources

Concrete value objects live under `app/models/chess/`:

- `Chess::FenPosition` declares FEN attributes and serialization.
- `Chess::CastlingRights` declares castling availability and FEN encoding.
- `Chess::Evaluation` declares the Stockfish/fallback evaluation schema.
- `Chess::EvalBar` declares the widget evaluation split invariant.

## Rails Wiring Later

The intended Rails routes are in `config/routes.rb`:

```ruby
root "analyses#new"
resources :analyses, only: [:new, :create, :show]
```

The current controller renders inline through ERB and does not persist analyses.
In a real Rails app, replace the placeholder `Analysis` model with an
ActiveRecord model using the schema in `../app_spec.md`, then have
`AnalysesController#create` save the payload and redirect to `show`.

## Stockfish Status

`Chess::StockfishAnalyzer` exposes the intended `evaluate_fen(fen, board:)`
interface and detects whether a `stockfish` executable is available. When
available, it invokes Stockfish through UCI at the configured depth. If Stockfish
is missing, errors, or times out, it uses a deterministic material-count
fallback:

- positive centipawns favor White
- negative centipawns favor Black
- `source` records whether the value came from Stockfish or fallback material
  evaluation

`Chess::EvaluationSchema` documents and validates the evaluation shape. Stockfish
UCI scores are normalized from side-to-move perspective into White perspective
before entering the payload.

The Docker path uses Stockfish 18. Local non-Docker runs may still use fallback
unless Stockfish is installed on the host.

## Current Limitations

- Move legality is sufficient for normal SAN replay and the provided sample,
  but it is not a complete chess arbiter.
- Check and checkmate flags are trusted from SAN markers (`+` and `#`).
- En passant support is basic.
- No persistence, background jobs, authentication, or database.
- The embedded widget is a minimal local preview, not the final widget package.
