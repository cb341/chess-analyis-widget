FROM ruby:3.3-slim

ARG STOCKFISH_URL=https://github.com/official-stockfish/Stockfish/releases/download/sf_18/stockfish-ubuntu-x86-64-avx2.tar

WORKDIR /app

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends build-essential ca-certificates curl libpq-dev tar; \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    mkdir -p /tmp/stockfish-download; \
    curl -fsSL "$STOCKFISH_URL" -o /tmp/stockfish.tar; \
    tar -xf /tmp/stockfish.tar -C /tmp/stockfish-download; \
    install -m 0755 "$(find /tmp/stockfish-download -type f -name 'stockfish*' -perm /111 | head -n 1)" /usr/local/bin/stockfish; \
    rm -rf /tmp/stockfish-download /tmp/stockfish.tar; \
    stockfish bench 1

COPY Gemfile /app/Gemfile
RUN bundle install

COPY . /app

ENV HOST=0.0.0.0
ENV PORT=3000
ENV STOCKFISH_PATH=/usr/local/bin/stockfish
ENV STOCKFISH_DEPTH=10
ENV STOCKFISH_TIMEOUT=2.0

EXPOSE 3000

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
