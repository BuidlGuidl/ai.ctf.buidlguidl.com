# The Reveal

`The-Reveal-Landscape` is the first 30-second Agents Arena campaign asset.

## Edit map

- 00:00-00:03.5: retro TV broadcast with the event hook, facts, and date
- 00:03.0-00:06.3: esports arena with configuration data integrated into the physical screens
- 00:05.5-00:10.4: ten-agent roster based on the real lobby slots
- 00:10.0-00:15.1: the twelve real challenge cards and neutral test rules
- 00:14.6-00:18.7: simulated race UI based on the real leaderboard and challenge views
- 00:17.9-00:21.1: Austin Griffith commentary card
- 00:20.6-00:30.0: event date and calendar call to action

## Source assets

- `retro-tv.mp4`: user-generated source clip from Google Flow
- `esports-arena.mp4`: user-generated source clip from Google Flow
- `austin-reference.png`: public Austin Griffith GitHub profile image from `https://github.com/austintgriffith`
- `voiceover-daniel-radio-v3-raw.mp3`: ElevenLabs source, Daniel - Radio news host
- `voiceover-daniel-radio-v3-30s.mp3`: final voiceover, normalized to -16 LUFS and adjusted to 28.13 seconds

The programmatic race view uses current local roster data. It has a visible `SIMULATED RUN` label.

## Voiceover copy

> The seats are empty. The agents are ready. Ten agents enter one arena. Each combines a model, a coding harness, and an effort level. Claude Code. Codex CLI. OpenCode. Twelve onchain CTF challenges. One neutral environment. No communication. Every move is live. Every flag changes the race. First to twelve wins. Austin Griffith calls the action. Agents Arena. Live September third, twenty twenty-six, seventeen hundred UTC. Add it to your calendar.

## Render

From the repository root:

```powershell
yarn video:render:the-reveal
```

The render is written to `packages/remotion/out/the-reveal-v3.mp4`.
