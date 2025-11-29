# Sound Effects for AR Activity

This directory contains sound effects for the AR experience.

## Required Sound Files

### 1. Item Tap Sound (pop.mp3 / pop.ogg)
- **Purpose**: Plays when player taps a regular item
- **Suggested sound**: Light "pop" or "collect" sound (cheerful, short)
- **Duration**: 0.3-0.5 seconds
- **Volume**: Medium (currently set to 0.5)
- **Examples**:
  - Pop sound effect
  - Bubble pop
  - Coin collect
  - Bell chime

### 2. Boss Hit Sound (hit.mp3 / hit.ogg)
- **Purpose**: Plays when player taps the boss
- **Suggested sound**: Impact or damage sound (powerful, punchy)
- **Duration**: 0.3-0.7 seconds
- **Volume**: Medium-high (currently set to 0.6)
- **Examples**:
  - Punch/hit impact
  - Sword slash
  - Explosion (short)
  - Thunder crack

## File Formats

Provide both MP3 and OGG formats for maximum browser compatibility:
- `pop.mp3` + `pop.ogg` (regular item)
- `hit.mp3` + `hit.ogg` (boss hit)

## Free Sound Resources

You can find free sound effects at:
- https://freesound.org/
- https://mixkit.co/free-sound-effects/
- https://pixabay.com/sound-effects/
- https://www.zapsplat.com/

## Converting to OGG

Use ffmpeg to convert MP3 to OGG:
```bash
ffmpeg -i pop.mp3 -c:a libvorbis -q:a 4 pop.ogg
ffmpeg -i hit.mp3 -c:a libvorbis -q:a 4 hit.ogg
```
