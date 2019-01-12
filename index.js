const path = require('path');
const { mkdirp, readFile, writeFile } = require('fs-extra');
const fs = require('fs');

const execa = require('execa');
const { createLambda } = require('@now/build-utils/lambda.js');
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js');
const download = require('@now/build-utils/fs/download.js');
const downloadGit = require('lambda-git');
const glob = require('@now/build-utils/fs/glob.js');
const downloadGoBin = require('./download-go-bin');

// creates a `$GOPATH` directory tree, as per
// `go help gopath`'s instructions.
// without this, Go won't recognize the `$GOPATH`
async function createGoPathTree(goPath) {
  await mkdirp(path.join(goPath, 'bin'));
  await mkdirp(path.join(goPath, 'pkg', 'linux_amd64'));
}

exports.config = {
  maxLambdaSize: '10mb',
};

async function buildGoLambda({
  goBin,
  goEnv,
  downloadedFiles,
  outDir,
  entrypoint
}) {
  console.log(`parsing AST for "${entrypoint}"`);
  let handlerFunctionName = '';
  try {
    handlerFunctionName = await execa.stdout(
      path.join(__dirname, 'bin', 'get-exported-function-name'),
      [downloadedFiles[entrypoint].fsPath]
    );
  } catch (err) {
    console.log(`failed to parse AST for "${entrypoint}"`);
    throw err;
  }

  if (handlerFunctionName === '') {
    const e = new Error(
      `Could not find an exported function on "${entrypoint}"`
    );
    console.log(e.message);
    throw e;
  }

  console.log(
    `Found exported function "${handlerFunctionName}" on "${entrypoint}"`
  );

  const origianlMainGoContents = await readFile(
    path.join(__dirname, 'main.go'),
    'utf8'
  );
  const mainGoContents = origianlMainGoContents.replace(
    '__NOW_HANDLER_FUNC_NAME',
    handlerFunctionName
  );
  // in order to allow the user to have `main.go`, we need our `main.go` to be called something else
  const mainGoFileName = 'main__now__go__.go';

  const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);

  // we need the Now bridge `main.go` in the same dir as the entrypoint,
  await writeFile(path.join(entrypointDirname, mainGoFileName), mainGoContents);

  console.log('running go build...');
  try {
    await execa(
      goBin,
      [
        'build',
        '-mod=vendor',
        '-o',
        path.join(outDir, path.dirname(entrypoint), 'handler'),
        path.join(entrypointDirname, mainGoFileName),
        downloadedFiles[entrypoint].fsPath
      ],
      { env: goEnv, cwd: entrypointDirname, stdio: 'inherit' }
    );
  } catch (err) {
    console.log('failed to `go build`');
    throw err;
  }

  return createLambda({
    files: await glob('**', path.join(outDir, path.dirname(entrypoint))),
    handler: 'handler',
    runtime: 'go1.x',
    environment: {}
  });
}

exports.build = async ({ files, entrypoint, config }) => {
  const options = Object.assign({
    // Where be *all* the lambdas?
    // this builder only looks for lambda code in what I've called the "lambda base directory"
    lambdaBaseDir: "cmd",
    // within the base directory, only files with a special name are considered lambdas
    lambdaFileName: "lambda.go"
  }, config);

  /*
   * Setup Go build environment
   */

  console.log('downloading files...');

  const gitPath = await getWritableDirectory();
  const goPath = await getWritableDirectory();
  const srcPath = path.join(goPath, 'src', 'lambda');
  const outDir = await getWritableDirectory();

  await createGoPathTree(goPath);

  const downloadedFiles = await download(files, srcPath);
  const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);

  console.log('downloading go binary...');
  const goBin = await downloadGoBin();

  console.log('downloading git binary...');
  // downloads a git binary that works on Amazon Linux and sets
  // `process.env.GIT_EXEC_PATH` so `go(1)` can see it
  await downloadGit({ targetDirectory: gitPath });

  const goEnv = {
    ...process.env,
    GOOS: 'linux',
    GOARCH: 'amd64',
    GOPATH: goPath,
    CGO_ENABLED: '0',
    GO111MODULE: 'on'
  };

  /*
   * Install dependencies
   */
  console.log(`checking dependencies of ${entrypointDirname}`);
  const vendorDir = path.join(entrypointDirname, 'vendor');
  if (!fs.existsSync(vendorDir)) {
    console.log('WARNING: "vendor" directory not found. If you have dependencies, make sure you using vendoring and that they arent ignored by `.nowignore`');
  }

  /*
   * Find Go lambda source files (configurable)
   */
  const lambdasDir = path.join(entrypointDirname, options.lambdaBaseDir);
  console.log(
    `finding lambdas named ${options.lambdaFileName} in ${lambdasDir}`
  );
  if (!fs.existsSync(lambdasDir)) {
    throw new Error(`lambda directory ${lambdasDir} not found`);
  }
  const goLambdaFiles = Object.keys(
    await glob(`**/${options.lambdaFileName}`, lambdasDir)
  );

  /*
   * Build all Go lambdas
   */
  console.log(`building ${goLambdaFiles.length} lambdas`);
  const lambdas = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const f of goLambdaFiles) {
    const lambdaEntryPoint = path.join(
      path.dirname(entrypoint),
      options.lambdaBaseDir,
      f
    );
    // TODO: Replace this because it uses the `go.mod` instead of the `lambdas_dir/f`
    path.join();
    // eslint-disable-next-line no-await-in-loop
    lambdas[lambdaEntryPoint] = await buildGoLambda({
      goBin,
      goEnv,
      downloadedFiles,
      outDir,
      entrypoint: lambdaEntryPoint
    });
  }

  return lambdas;
};
