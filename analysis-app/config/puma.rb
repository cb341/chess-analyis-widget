# frozen_string_literal: true

port Integer(ENV.fetch("PORT", 3000))
bind "tcp://#{ENV.fetch("HOST", "0.0.0.0")}:#{ENV.fetch("PORT", 3000)}"
environment ENV.fetch("RAILS_ENV", "development")
plugin :tmp_restart
