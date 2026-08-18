# AI CTF marketing videos

This workspace contains the Remotion setup for programmatic Agent Arena marketing videos. It is intentionally separate from the Next.js app so video dependencies, assets, and renders do not affect the product runtime.

## Commands

Run these from the repository root:

```bash
yarn video:studio
yarn video:compositions
yarn video:check
yarn video:render AgentArena-Landscape out/my-video.mp4
yarn video:still AgentArena-Landscape out/preview.png --frame=90
```

`yarn video:render:starter` renders the included six-second landscape starter. Rendered files go to `packages/remotion/out/` and are ignored by Git.

## Structure

- `src/Root.tsx` registers every renderable composition.
- `src/compositions/` contains one component per video or reusable format.
- `src/theme.ts` mirrors the existing Agent Arena color tokens.
- `public/` stores images, screen recordings, audio, fonts, and other static assets.
- `out/` is local render output.

## Adding a video

1. Add a component under `src/compositions/`.
2. Register it in `src/Root.tsx` with its dimensions, frame rate, duration, and default props.
3. Preview it in Studio before rendering the final file.

Drive every animation from `useCurrentFrame()` so previews and renders stay deterministic. Reference anything in `public/` with `staticFile()`.
