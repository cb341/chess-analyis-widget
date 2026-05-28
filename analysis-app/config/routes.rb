# frozen_string_literal: true

Rails.application.routes.draw do
  root "about#index"
  resources :analyses, only: [:index, :new, :create, :show]
end
