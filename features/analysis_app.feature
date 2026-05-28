Feature: Server-side chess analysis
  The analysis app turns a pasted PGN into text analysis and widget-ready JSON.

  Background:
    Given the sample Chess.com PGN from the project prompt

  Scenario: Analyze the sample game
    When I submit the PGN to the analysis app
    Then I see progress while Stockfish analysis is running
    Then the response includes parsed game metadata
    And the response includes 46 board positions
    And the response includes 45 analyzed moves
    And move 11 for White is marked as castling
    And move 23 for White is marked as checkmate
    And every position includes an evaluation bar

  Scenario: Render a plain text analysis
    When I submit the PGN to the analysis app
    Then the text analysis includes Unicode chess pieces
    And the text analysis includes compact annotations such as "!", "?!", "??", or "!!"
    And the text analysis includes a text evaluation bar

  Scenario: Render a Markdown analysis response
    When I submit the PGN to the analysis app
    Then the Markdown analysis includes Unicode chess pieces
    And the Markdown analysis includes compact annotations such as "!", "?!", "??", or "!!"
    And the Markdown analysis includes a move table
    And the Markdown analysis includes a Markdown-safe evaluation bar

  Scenario: Use Stockfish when available
    Given Stockfish 18 is available in the container
    When the analysis app evaluates a position
    Then it asks Stockfish for a UCI evaluation
    And it falls back to material evaluation if Stockfish fails or times out

  Scenario: Review saved analyses
    Given at least one game has been analyzed
    When I open the analyses index
    Then I see the saved games
    And I can open a saved game
    And I can inspect its metadata, moves, evaluations, and board snapshots
