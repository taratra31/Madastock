import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../src/services/dataTransfer.service';

describe(' utilitaire CSV', () => {
  it('échappe les cellules qui contiennent un séparateur ou un guillemet', () => {
    const csv = toCsv(['Nom', 'Prix'], [['Riz; 5kg', 3500], ['Quote "special"', 1000]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Riz; 5kg"');
    expect(csv).toContain('"Quote ""special"""');
  });

  it('lit un fichier avec point-virgule et avec virgule', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('respecte les guillemets, les retours à la ligne et le BOM', () => {
    const content = '\uFEFFnom;prix\n"Riz\n5kg";3500';
    expect(parseCsv(content)).toEqual([['nom', 'prix'], ['Riz\n5kg', '3500']]);
  });

  it('ignore les lignes vides', () => {
    expect(parseCsv('a;b\n\n1;2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('accepte un fichier Excel avec CRLF', () => {
    expect(parseCsv('a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});
