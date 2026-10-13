import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Static color checks against the actual stylesheet values. Geometry, browser
// compositing and keyboard focus visibility still require browser verification.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const globalStyles = read('src/styles.scss');
const login = read('src/app/features/login/login.scss');
const tasks = read('src/app/features/tasks/tasks.ts');
const sidebar = read('src/app/layout/shell.scss');

function color(source, token) {
  const value = source.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  assert.ok(value, `Missing color ${token}`);
  return value;
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const [name, styles, backgrounds] of [
  ['Login auxiliary text', login, ['--surface-elevated']],
  ['Tasks auxiliary text', tasks, ['--canvas', '--surface', '--surface-elevated']],
  ['Sidebar auxiliary text', sidebar, ['--surface-sidebar']],
]) {
  test(`${name} has at least 4.5:1 contrast`, () => {
    for (const background of backgrounds) {
      const ratio = contrast(color(styles, '--text-muted'), color(globalStyles, background));
      assert.ok(ratio >= 4.5, `${name} / ${background}: ${ratio.toFixed(2)}:1`);
    }
  });
}

test('Login placeholder is opaque and has at least 4.5:1 contrast', () => {
  const rule = login.match(/\.login-form input::placeholder\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'Missing scoped placeholder rule');
  const token = rule.match(/color:\s*var\((--[\w-]+)\)/)?.[1];
  assert.ok(token, 'Missing placeholder color');
  assert.match(rule, /opacity:\s*1\s*;/);
  assert.ok(contrast(color(login, token), color(globalStyles, '--surface')) >= 4.5);
});

test('Sidebar focus outlines exceed 3:1 on normal, hover, selected and button surfaces', () => {
  const outlines = [...sidebar.matchAll(/outline:\s*3px solid var\((--[\w-]+)\)/g)];
  assert.ok(outlines.length > 0, 'Missing sidebar focus outlines');
  for (const [, token] of outlines) {
    for (const background of ['--surface-sidebar', '--surface-sidebar-hover', '--surface-sidebar-active', '--surface', '--brand-primary-soft']) {
      const ratio = contrast(color(globalStyles, token), color(globalStyles, background));
      assert.ok(ratio >= 3, `${token} / ${background}: ${ratio.toFixed(2)}:1`);
    }
  }
});
