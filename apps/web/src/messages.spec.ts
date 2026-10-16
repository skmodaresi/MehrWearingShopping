import fa from '../messages/fa-IR.json';
import en from '../messages/en.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  );
}

/**
 * The two catalogues must stay in lockstep: a missing key in either language
 * would surface as raw translation keys in the UI at runtime.
 */
describe('i18n message catalogues', () => {
  const faKeys = flatten(fa as Tree).sort();
  const enKeys = flatten(en as Tree).sort();

  it('defines exactly the same keys in fa-IR and en', () => {
    expect(enKeys).toEqual(faKeys);
  });

  it('has no empty translations', () => {
    for (const file of [fa, en]) {
      const walk = (tree: Tree, path: string[] = []): void => {
        for (const [key, value] of Object.entries(tree)) {
          if (typeof value === 'string') {
            expect(value.trim().length).toBeGreaterThan(0);
          } else {
            walk(value, [...path, key]);
          }
        }
      };
      walk(file as Tree);
    }
  });

  it('keeps ICU placeholders intact in both languages', () => {
    // Every {placeholder} used in Persian must exist in English too.
    const placeholders = (source: string): string[] => source.match(/\{[a-zA-Z]+\}/g) ?? [];
    const collect = (tree: Tree, into: Map<string, string>): void => {
      for (const [key, value] of Object.entries(tree)) {
        if (typeof value === 'string') into.set(key, value);
        else collect(value, into);
      }
    };
    const faFlat = new Map<string, string>();
    const enFlat = new Map<string, string>();
    collect(fa as Tree, faFlat);
    collect(en as Tree, enFlat);

    for (const [key, value] of faFlat) {
      expect(placeholders(enFlat.get(key) ?? '').sort()).toEqual(placeholders(value).sort());
    }
  });
});
