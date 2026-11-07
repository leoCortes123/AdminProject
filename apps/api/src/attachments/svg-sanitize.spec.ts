import { describe, expect, it } from 'vitest';
import { isSvgSafe } from './svg-sanitize';

describe('isSvgSafe (F2-T05 · R-06)', () => {
  it('acepta un diagrama limpio', () => {
    expect(
      isSvgSafe('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'),
    ).toBe(true);
  });

  it('rechaza script, handlers y javascript:', () => {
    expect(
      isSvgSafe('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    ).toBe(false);
    expect(
      isSvgSafe('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>'),
    ).toBe(false);
    expect(
      isSvgSafe(
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>x</text></a></svg>',
      ),
    ).toBe(false);
  });

  it('rechaza foreignObject y href externos; permite fragmentos locales', () => {
    expect(
      isSvgSafe(
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body/></foreignObject></svg>',
      ),
    ).toBe(false);
    expect(
      isSvgSafe(
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="https://evil.example/x"><text>x</text></a></svg>',
      ),
    ).toBe(false);
    expect(
      isSvgSafe(
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="#forma"/><g id="forma"/></svg>',
      ),
    ).toBe(true);
  });
});
