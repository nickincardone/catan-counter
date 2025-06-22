import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/content.ts',
  output: {
    file: 'content.js',
    format: 'iife', // Immediately Invoked Function Expression - perfect for browser extensions
    name: 'CatanCounter'
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
}; 