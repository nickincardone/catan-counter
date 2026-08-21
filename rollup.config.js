import typescript from '@rollup/plugin-typescript';
import path from 'path';

// This repo otherwise has no third-party runtime imports, so resolve its one
// browser ESM dependency explicitly instead of adding a general resolver.
const msgpackEntry = path.resolve(
  'node_modules/@msgpack/msgpack/dist.esm/index.mjs'
);
const resolveMsgpack = {
  name: 'resolve-msgpack',
  resolveId(source) {
    return source === '@msgpack/msgpack' ? msgpackEntry : null;
  },
};

function config(input, file, name) {
  return {
    input,
    output: {
      file,
      format: 'iife',
      name,
    },
    plugins: [
      resolveMsgpack,
      typescript({
        tsconfig: './tsconfig.json',
      }),
    ],
  };
}

// The replay decoder also runs outside the browser, as a command-line tool for
// turning saved raw replays into decoded records.
const replayCli = {
  input: 'src/replay/cli.ts',
  output: { file: 'scripts/decode-replay.js', format: 'cjs' },
  external: ['node:fs', 'node:path'],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
};

export default [
  replayCli,
  config(
    'src/pageTransportHook.ts',
    'page-transport-hook.js',
    'CatanTransportHook'
  ),
  config('src/content.ts', 'content.js', 'CatanCounter'),
  config('src/popup/popup.ts', 'popup.js', 'CatanCounterPopup'),
  // Development-only: dev-preview.html renders the v2 UI against a seeded game
  // so it can be worked on without a live colonist match. Nothing in
  // manifest.json references it.
  config('src/dev/preview.ts', 'dev-preview.js', 'CatanCounterPreview'),
];
