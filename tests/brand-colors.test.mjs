import test from 'node:test';
import assert from 'node:assert/strict';
import { brandColor, contrastRatio, readableInk, readableAccent } from '../lib/brand-colors.ts';
test('cream club surfaces use dark readable text', () => {
  assert.equal(readableInk('#fff9f1'), '#061a39');
  assert.ok(contrastRatio(readableAccent('#5170ff','#fff9f1'),'#fff9f1') >= 4.5);
});
test('foregrounds remain readable across dark, bright and mid-tone brands', () => {
  for (const color of ['#061a39','#ffffff','#000000','#00b0fe','#5170ff','#777777','#808080','#ffcc00','#ee0000','#008800']) {
    assert.ok(contrastRatio(readableInk(color),color) >= 4.5, color);
  }
});
test('valid accents are retained and invalid colours use a safe fallback', () => {
  assert.equal(readableAccent('#ffffff','#061a39'),'#ffffff');
  assert.equal(brandColor('red; color:white'), '#2458ff');
  assert.equal(brandColor(null,'#061a39'),'#061a39');
  assert.equal(brandColor('#FFF9F1'),'#FFF9F1');
});
