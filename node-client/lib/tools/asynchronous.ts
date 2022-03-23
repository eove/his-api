export function wait(delayInMs: number): Promise<void> {
  return new Promise((r) => setTimeout(r, delayInMs));
}
