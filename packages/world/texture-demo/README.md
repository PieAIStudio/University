# Island texture demo

This page is intentionally outside the University renderer. It uses the same
Three.js version as `@pieai/university-world`, but owns its own deterministic
terrain, shader, camera, and render loop so the texture decision can be
measured without changing a product island.

From the repository root:

```sh
pnpm --filter @pieai/university-app exec vite ../../packages/world --host 127.0.0.1 --port 4173
```

Open <http://127.0.0.1:4173/texture-demo/>. Query parameters are optional:

- `textures=on|off`
- `materials=multi|single`
- `projection=hybrid|full`
- `view=near|far`
- `seed=17`
- `freeze=1` to render one stable frame for screenshots

The final WebP files live in `packages/world/public/island-textures/`. The
source renders used during production are deliberately ignored under
`tmp/island-textures-input/`; run `uv run --with pillow python
scripts/prepare-island-textures.py` after supplying source images there.
