'use strict';

const { execFileSync } = require('node:child_process');

function gitStatus() {
  return execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { encoding: 'utf8' },
  ).trim();
}

try {
  const status = gitStatus();

  if (status) {
    console.error('Working tree is not clean. Resolve, commit, stash, or discard these changes before continuing:');
    console.error(status);
    process.exitCode = 1;
  } else {
    console.log('Working tree is clean.');
  }
} catch (error) {
  console.error(`Unable to verify Git working tree: ${error.message}`);
  process.exitCode = 1;
}
