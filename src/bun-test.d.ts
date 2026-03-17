declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => Promise<void> | void): void;
  export function afterEach(fn: () => Promise<void> | void): void;
  export function expect(value: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    not: {
      toBe(expected: unknown): void;
    };
  };
}
