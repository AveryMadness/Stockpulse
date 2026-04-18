import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.stubGlobal('ResizeObserver', class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
});
