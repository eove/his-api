import { performance } from 'perf_hooks';
import { wait } from './asynchronous';

describe('Asynchronous module', () => {
  describe('on wait', () => {
    it('should wait provided delay', async () => {
      const start = performance.now();

      await wait(150);

      const duration = performance.now() - start;
      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(200);
    });
  });
});
