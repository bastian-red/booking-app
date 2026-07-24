import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ name: z.string().min(1), age: z.number().int().min(0) });

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data on valid input', () => {
    expect(pipe.transform({ name: 'Ana', age: 30 })).toEqual({ name: 'Ana', age: 30 });
  });

  it('throws BadRequest on invalid input', () => {
    expect(() => pipe.transform({ name: '', age: -1 })).toThrow();
  });
});
