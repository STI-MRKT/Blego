const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { IMAGE_LIMITS } = require('../../../shared/metadata-contracts.mjs');
const unpack = (file) => file.replace(/app\.asar([/\\])/, 'app.asar.unpacked$1');
function invocation(runtimeRoot) {
  const root =
    runtimeRoot ||
    (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'metadata-runtime'))
      ? path.join(process.resourcesPath, 'metadata-runtime')
      : path.resolve(
          __dirname,
          '../../../build/metadata-runtime',
          `${process.platform}-${process.arch}`
        ));
  if (process.platform === 'win32') {
    const command = path.join(root, 'exiftool.exe');
    if (!fs.existsSync(command)) throw Error('METADATA_ENGINE_UNAVAILABLE');
    return { command, prefix: [], env: { ...process.env } };
  }
  const command = path.join(root, 'bin/perl');
  if (!fs.existsSync(command)) throw Error('METADATA_ENGINE_UNAVAILABLE');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('PERL')) delete env[key];
  env.BLEGO_PERL_LIBS = [path.join(root, 'lib/core'), path.join(root, 'lib/arch')].join('\x1f');
  let script;
  try {
    script = unpack(require('exiftool-vendored.pl'));
  } catch {
    throw Error('METADATA_ENGINE_UNAVAILABLE');
  }
  return {
    command,
    prefix: [
      unpack(path.resolve(__dirname, '../../../resources/metadata/perl-bootstrap.pl')),
      script
    ],
    env
  };
}
function createEngine({ runtimeRoot } = {}) {
  async function execute(args, { signal } = {}) {
    const { command, prefix, env } = invocation(runtimeRoot);
    return new Promise((resolve, reject) => {
      let bytes = 0,
        failed = null;
      const stdout = [],
        stderr = [];
      const child = spawn(
        command,
        [...prefix, '-config', '', '-charset', 'filename=UTF8', ...args],
        {
          shell: false,
          windowsHide: true,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          signal,
          cwd: path.dirname(command)
        }
      );
      const timeout = setTimeout(() => {
        failed = 'METADATA_ENGINE_TIMEOUT';
        child.kill('SIGKILL');
      }, IMAGE_LIMITS.engineMs);
      function collect(list, chunk) {
        bytes += chunk.length;
        if (bytes > IMAGE_LIMITS.engineBytes) {
          failed = 'METADATA_ENGINE_OUTPUT_LIMIT';
          child.kill('SIGKILL');
        } else if (!failed) list.push(chunk);
      }
      child.stdout.on('data', (chunk) => collect(stdout, chunk));
      child.stderr.on('data', (chunk) => collect(stderr, chunk));
      child.on('error', (error) => {
        clearTimeout(timeout);
        reject(
          Error(
            signal?.aborted
              ? 'CANCELLED'
              : error.code === 'ENOENT'
                ? 'METADATA_ENGINE_UNAVAILABLE'
                : 'METADATA_ENGINE_FAILED'
          )
        );
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (signal?.aborted) return reject(Error('CANCELLED'));
        if (failed || code !== 0) return reject(Error(failed || 'METADATA_ENGINE_FAILED'));
        resolve({ stdout: Buffer.concat(stdout).toString('utf8'), warning: stderr.length > 0 });
      });
    });
  }
  return {
    async writeCopy(file, operations, format, { signal, before } = {}) {
      const { writeArgs } = require('./write-policy.cjs');
      if (
        !before &&
        operations.some((op) => op.field === 'captureDate' && op.value?.offsetMode === 'keep')
      )
        before = (await this.read(file, { signal })).tags;
      return execute([...writeArgs(operations, format, before), '--', path.resolve(file)], {
        signal
      });
    },
    async read(file, { signal } = {}) {
      const result = await execute(
        ['-j', '-G1:4', '-a', '-s', '-n', '-api', 'StructFormat=JSONQ', '--', path.resolve(file)],
        { signal }
      );
      let data;
      try {
        data = JSON.parse(result.stdout);
      } catch {
        throw Error('METADATA_ENGINE_OUTPUT_INVALID');
      }
      if (
        !Array.isArray(data) ||
        data.length !== 1 ||
        Object.keys(data[0]).some((key) => /(^|:)Error$/.test(key))
      )
        throw Error('METADATA_ENGINE_OUTPUT_INVALID');
      return { tags: data[0], warning: result.warning };
    }
  };
}
module.exports = { createEngine };
