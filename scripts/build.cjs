const path = require('path');
const loadConfigFile = require('rollup/loadConfigFile');
const { rollup } = require('rollup');

async function build() {
  const { options, warnings } = await loadConfigFile(
    path.resolve('rollup.config.js')
  );
  if (warnings.count > 0) warnings.flush();

  for (const option of options) {
    const bundle = await rollup(option);
    for (const output of option.output) await bundle.write(output);
    await bundle.close();
  }
}

build().then(
  () => {
    // @rollup/plugin-typescript leaves TypeScript FS watchers alive on the
    // pinned Node 24 even after buildEnd closes its watch program.
    process.exit(0);
  },
  error => {
    console.error(error);
    process.exit(1);
  }
);
