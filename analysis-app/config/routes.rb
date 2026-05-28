# frozen_string_literal: true

Rails.application.routes.draw do
  root "analyses#new"
  resources :analyses, only: [:index, :new, :create, :show]
end
