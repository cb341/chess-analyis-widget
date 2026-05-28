# Chess Analysis App

Rails app for PGN analysis, Stockfish-backed evaluation, PostgreSQL persistence, and widget-ready JSON output.

## Local Development

Use the repository scripts from the monorepo root:

```sh
bin/setup
bin/run
```

`bin/setup` installs dependencies, copies `.env.example` to `.env` if needed, downloads Stockfish 18 to `analysis-app/vendor/stockfish/`, and runs `rails db:prepare`.

`bin/run` prepares the database and starts Rails. Rails loads the monorepo `.env` during boot.

## Routes

```ruby
root "analyses#new"
resources :analyses, only: [:index, :new, :create, :show]
```

## Database

The app uses PostgreSQL through Active Record.

```sh
cd analysis-app
bundle exec rails db:prepare
bundle exec rails db:migrate
```

`Analysis` records use a deterministic string primary key derived from the PGN input. The table stores:

- `id`
- `pgn`
- `payload` as `jsonb`
- Rails timestamps

## Stockfish

Local development uses the Stockfish binary referenced by `STOCKFISH_PATH` in `.env`.

Docker production images install Stockfish 18 at:

```text
/usr/local/bin/stockfish
```

If Stockfish is unavailable, `Chess::StockfishAnalyzer` falls back to material evaluation and records `source: "fallback_material"` in the payload.

## Service Entry Point

```ruby
payload = Chess::AnalysisBuilder.new.build(pgn)
```

The payload includes metadata, moves, positions, FENs, evaluations, annotations, summary text, `text_analysis`, and `markdown_analysis`.

## Production Container

From the monorepo root:

```sh
docker compose up --build analysis-app
```

Compose starts PostgreSQL and Rails only to verify the production Dockerfile locally. The production Dockerfile installs Stockfish from Debian packages so image builds do not depend on GitHub release downloads. Day-to-day development uses local Ruby, Bun, PostgreSQL, and the Stockfish binary installed by `bin/setup`.
