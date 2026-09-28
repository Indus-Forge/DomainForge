import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Every source file under src. */
function sources(dir = fileURLToPath(new URL('../src', import.meta.url))): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

describe('effects', () => {
  // React runs whatever an effect returns as its clean-up. An effect written as `() => call()` returns the
  // call's result: newer browsers return a promise from scrollIntoView, and the whole app went blank
  // with "destroy is not a function". Effects must use braces, and return only a clean-up function.
  it('never hand React a value it would try to run as a clean-up', () => {
    const offenders = sources().flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/use(?:Layout)?Effect\(\(\) =>(?!\s*\{)[^\n]*/g)].map((m) => `${file}: ${m[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
