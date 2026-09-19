/// <reference types="node" />
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { catalog, numberText, parsePreference, resolveLanguage, translate, translateError } from './core';
import { mapModes, preparationLabels } from '../services/mapPolicy';
it('resolves device languages and explicit overrides', () => {
  expect(resolveLanguage('system', 'de-DE')).toBe('de');
  expect(resolveLanguage('system', 'ru_RU')).toBe('ru');
  expect(resolveLanguage('system', 'fr-FR')).toBe('en');
  expect(resolveLanguage('en', 'de-DE')).toBe('en');
  expect(parsePreference('broken')).toBe('system');
});
it('has complete translations with identical placeholders', () => {
  for (const [key, values] of Object.entries(catalog)) {
    expect(values).toHaveLength(2);
    for (const value of values) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(/[А-Яа-яЁё]/.test(value), key).toBe(false);
      expect(value.match(/\{\w+\}/g)?.sort() ?? [], key).toEqual(key.match(/\{\w+\}/g)?.sort() ?? []);
    }
  }
});
it('covers UI keys, service errors and dynamic map labels', () => {
  const keys = [...mapModes.flatMap(x => [x.title, x.description]), ...Object.values(preparationLabels)];
  for (const dir of ['src/components', 'src/screens', 'src/services']) for (const file of readdirSync(dir).filter(x => /\.tsx?$/.test(x) && !x.includes('.test.'))) {
    const source = ts.createSourceFile(file, readFileSync(`${dir}/${file}`, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    function visit(node: ts.Node) {
      if ((ts.isCallExpression(node) && node.expression.getText(source) === 't') || (ts.isNewExpression(node) && node.expression.getText(source) === 'Error')) {
        const arg = node.arguments?.[0];
        if (arg && ts.isStringLiteral(arg) && /[А-Яа-яЁё]/.test(arg.text)) keys.push(arg.text);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  for (const key of keys) expect(catalog[key], key).toBeDefined();
});
it('formats numbers and errors without losing user values', () => {
  expect(numberText('de', 12.5)).toBe('12,5');
  expect(numberText('en', 12.5)).toBe('12.5');
  expect(translate('de', 'Открыть маршрут {v0}', {v0: 'Berlin'})).toContain('Berlin');
  expect(translateError('en', new Error('Native: GPX содержит некорректные координаты.'))).toBe('The GPX contains invalid coordinates.');
  expect(translateError('de', new Error('EIO'))).not.toContain('EIO');
  expect(translate('ru', 'Язык')).toBe('Язык');
});

