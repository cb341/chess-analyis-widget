# frozen_string_literal: true

begin
  require "active_model"
rescue LoadError
  # The WEBrick POC runs without Rails gems. In Rails, these models include
  # ActiveModel::Model automatically; outside Rails they keep the same initializer.
end

module Chess
  # Minimal ActiveModel bridge for value objects used by the analysis pipeline.
  module ModelSupport
    def self.included(base)
      base.include(ActiveModel::Model) if defined?(ActiveModel::Model)
    end

    def initialize(attributes = {})
      attributes.each do |name, value|
        writer = "#{name}="
        public_send(writer, value) if respond_to?(writer)
      end
    end
  end
end
