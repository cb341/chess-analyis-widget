Feature: Static chess widget
  The widget renders a precomputed analysis payload without calling an API.

  Background:
    Given a page with embedded analyzed JSON
    And the page contains "<chess-widget data-source=\"game-data\"></chess-widget>"

  Scenario: Load the embedded game
    When the widget connects to the page
    Then it reads the JSON from the DOM
    And it renders the starting board
    And it does not call fetch, XMLHttpRequest, WebSocket, or EventSource

  Scenario: Step through the game
    When I press the next control
    Then the widget advances to the next board position
    And it highlights the last move
    And it updates the annotation overlay
    And it updates the evaluation bar

  Scenario: Navigate by keyboard
    When the widget has focus
    Then ArrowRight advances one ply
    And ArrowLeft goes back one ply
    And Home jumps to the start
    And End jumps to the final position

  Scenario: Jump from the move list
    When I choose a move from the move list
    Then the widget jumps to that ply
    And the selected move is marked active
