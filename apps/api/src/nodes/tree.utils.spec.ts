import { describe, expect, it } from 'vitest';
import {
  allocateDuplicateCodes,
  ltreeLabel,
  nextSiblingPosition,
  parseNodeCode,
  pathDepth,
  pathIsDescendantOrEqual,
} from './tree.utils';

describe('ltreeLabel', () => {
  it('minúsculas y guiones → guiones bajos', () => {
    expect(ltreeLabel('PANT-02')).toBe('pant_02');
    expect(ltreeLabel('MODULO-101')).toBe('modulo_101');
  });
});

describe('pathIsDescendantOrEqual', () => {
  it('igual → true', () => {
    expect(pathIsDescendantOrEqual('mod_01', 'mod_01')).toBe(true);
  });
  it('descendiente directo y profundo → true', () => {
    expect(pathIsDescendantOrEqual('mod_01', 'mod_01.pant_01')).toBe(true);
    expect(pathIsDescendantOrEqual('mod_01', 'mod_01.pant_01.comp_01')).toBe(true);
  });
  it('no descendiente → false', () => {
    expect(pathIsDescendantOrEqual('mod_01', 'mod_02')).toBe(false);
    expect(pathIsDescendantOrEqual('mod_01', 'mod_01x.pant_01')).toBe(false);
    expect(pathIsDescendantOrEqual('mod_01.pant_01', 'mod_01')).toBe(false);
  });
});

describe('pathDepth', () => {
  it('cuenta niveles - 1', () => {
    expect(pathDepth('mod_01')).toBe(0);
    expect(pathDepth('mod_01.pant_01.comp_01')).toBe(2);
  });
});

describe('parseNodeCode', () => {
  it('códigos válidos', () => {
    expect(parseNodeCode('PANT-02')).toEqual({ prefix: 'PANT', num: 2 });
    expect(parseNodeCode('MODULO_X-1234')).toEqual({ prefix: 'MODULO_X', num: 1234 });
  });
  it('rechaza formatos inválidos', () => {
    expect(parseNodeCode('pant-02')).toBeNull();
    expect(parseNodeCode('PANT')).toBeNull();
    expect(parseNodeCode('PANT-')).toBeNull();
    expect(parseNodeCode('')).toBeNull();
  });
});

describe('allocateDuplicateCodes', () => {
  it('asigna el siguiente número libre por prefijo', () => {
    const map = allocateDuplicateCodes(
      ['MOD-01', 'PANT-01', 'COMP-01'],
      ['MOD-01', 'PANT-01', 'PANT-02', 'COMP-01'],
    );
    expect(map.get('MOD-01')).toBe('MOD-02');
    expect(map.get('PANT-01')).toBe('PANT-03'); // max PANT existente = 2
    expect(map.get('COMP-01')).toBe('COMP-02');
  });

  it('varios nodos con el mismo prefijo se numeran en secuencia', () => {
    const map = allocateDuplicateCodes(['COMP-01', 'COMP-02'], ['COMP-01', 'COMP-02']);
    expect(map.get('COMP-01')).toBe('COMP-03');
    expect(map.get('COMP-02')).toBe('COMP-04');
  });

  it('tiene en cuenta códigos históricos borrados (ya presentes en existingCodes)', () => {
    const map = allocateDuplicateCodes(['MOD-01'], ['MOD-01', 'MOD-07']);
    expect(map.get('MOD-01')).toBe('MOD-08');
  });

  it('prefijo sin uso previo empieza en 01', () => {
    const map = allocateDuplicateCodes(['SERV-01'], []);
    expect(map.get('SERV-01')).toBe('SERV-01');
  });

  it('lanza con código inesperado', () => {
    expect(() => allocateDuplicateCodes(['sin-formato'], [])).toThrow();
  });
});

describe('nextSiblingPosition', () => {
  it('0 sin hermanos; max+1 en caso contrario', () => {
    expect(nextSiblingPosition([])).toBe(0);
    expect(nextSiblingPosition([0, 3, 1])).toBe(4);
  });
});
