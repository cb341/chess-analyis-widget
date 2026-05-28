# frozen_string_literal: true

Rails.application.routes.draw do
  root "analyses#new"
  resources :analyses, only: [:new, :create, :show]
  get "/admin/", to: "admin/analyses#index"
  namespace :admin do
    root "analyses#index"
    resources :analyses, only: [:index, :show]
  end
end
