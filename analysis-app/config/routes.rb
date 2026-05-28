# frozen_string_literal: true

require_relative "route_set"

if defined?(Rails)
  Rails.application.routes.draw do
    root "analyses#new"
    resources :analyses, only: [:new, :create]
    namespace :admin do
      root "analyses#index"
      resources :analyses, only: [:index, :show]
    end
  end
else
  ANALYSIS_ROUTES
end
