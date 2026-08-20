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

export default [
  config(
    'src/pageTransportHook.ts',
    'page-transport-hook.js',
    'CatanTransportHook'
  ),
  config('src/content.ts', 'content.js', 'CatanCounter'),
];
