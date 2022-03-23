export function mock<T>(constructor: () => Partial<T>): jest.Mock<T> {
  return jest.fn(() => constructor() as any as T);
}
