FROM ruby:3.3-slim

WORKDIR /app

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends build-essential ca-certificates libpq-dev libyaml-dev stockfish; \
    ln -sf "$(find /usr/games /usr/bin -type f -name stockfish -perm /111 | head -n 1)" /usr/local/bin/stockfish; \
    rm -rf /var/lib/apt/lists/*; \
    stockfish bench 1

COPY Gemfile Gemfile.lock /app/
RUN bundle install

COPY . /app

ENV HOST=0.0.0.0
ENV PORT=3000
ENV STOCKFISH_PATH=/usr/local/bin/stockfish
ENV STOCKFISH_DEPTH=10
ENV STOCKFISH_TIMEOUT=2.0

EXPOSE 3000

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
