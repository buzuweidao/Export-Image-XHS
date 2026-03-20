import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectLinks } from '../src/utils/projectLinks.js';

test('buildProjectLinks normalizes a .git repo URL and adds issues URL', () => {
  const links = buildProjectLinks('https://github.com/buzuweidao/Export-Image-XHS.git');

  assert.equal(links.repoUrl, 'https://github.com/buzuweidao/Export-Image-XHS');
  assert.equal(links.issuesUrl, 'https://github.com/buzuweidao/Export-Image-XHS/issues');
});

test('buildProjectLinks trims a trailing slash', () => {
  const links = buildProjectLinks('https://github.com/buzuweidao/Export-Image-XHS/');

  assert.equal(links.repoUrl, 'https://github.com/buzuweidao/Export-Image-XHS');
  assert.equal(links.issuesUrl, 'https://github.com/buzuweidao/Export-Image-XHS/issues');
});
