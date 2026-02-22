# Gilli Danda Legends (Browser Prototype)

A physics-focused, authentic-rule gilli danda game built with vanilla HTML/CSS/JS.

## Run

Open `/Users/mgtvalavan/Desktop/Screenshots/News Content Generation/GIlli game/index.html` in a modern browser.

## Controls

- `Space`: Flip gill
- `Enter`: Swing danda
- `R`: Start match (when not already running)
- `Arrow keys` / `WASD`: Move primary fielder when AI is batting (single-player fielding)
- UI Buttons: Flip, Swing, Start Match, Reset Series

## Rules Implemented

- 2 teams, default 5 batters each side
- Match modes:
  - Quick Match: 1 inning each
  - Classic: 2 innings each
- Batting flow:
  - Up to 3 flip attempts
  - Strike airborne gill for distance
- Outs:
  - Air catch
  - 3 failed flips
  - Fielder hits grounded danda with gilli
- Scoring:
  - Runs = floor(first landing distance / danda length)
  - Danda length fixed at 2.5 ft
  - 2+ mid-air hits double runs
- Tie handling:
  - Sudden-death strike-off

## Variants

- Classic
- Danguli (longer-distance bias)
- Chinni Dandu (stricter flip pressure)
- Viti Dandu (stronger throw-out pressure)

## Difficulty

- Easy Kids
- Club
- Pro Tournament

Difficulty affects catch quality, throw-out probability, and timing tolerance.

## New Match Options

- Control:
  - Single Player (you bat Team A, Team B uses AI batting logic)
  - Local Hotseat (manual control for both teams)
- Players per Team:
  - Configurable from 2 to 11 (wicket limit follows this value)

## Fielding Behavior

- When AI is fielding, it actively chases and attempts live catches (not just random instant outs).
- When AI is batting in single-player, you can field manually using:
  - On-screen joystick (touch/mouse drag)
  - Keyboard arrows/WASD
