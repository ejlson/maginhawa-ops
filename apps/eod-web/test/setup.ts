import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setNow } from '../app/lib/clock';
import { resetDeviceStore } from '../app/lib/store';

beforeEach(() => {
  localStorage.clear();
  resetDeviceStore();
  // 22:00 BST on Monday 5 October 2026 → trading day 2026-10-05.
  setNow(new Date('2026-10-05T21:00:00Z'));
});

afterEach(() => {
  cleanup();
  setNow(null);
});
