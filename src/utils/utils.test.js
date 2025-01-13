import {
  createDefaultExpireTimes,
  checkSessionStatus,
  renewSession,
  isSessionExpired,
  convertUTCToJSDate,
} from './utils.js';
import { getAuthState } from './auth.js';
import { apiConfig } from '../config/config.js';

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

global.window = {};
global.window.localStorage = new LocalStorageMock();

jest.mock('./auth.js', () => ({
  getAuthState: jest.fn(),
}));

describe('Utils', () => {
  beforeEach(() => {
    global.window = {};
    global.window.localStorage = new LocalStorageMock();
    global.document = {};
  });

  describe('createDefaultExpireTimes', () => {
    test('should create valid session and refresh expiry times', () => {
      const result = createDefaultExpireTimes(12);

      const now = new Date();
      const expectedExpiry = new Date(now.setHours(now.getHours() + 12));

      expect(result).toHaveProperty('session_expiry_time');
      expect(result).toHaveProperty('refresh_expiry_time');

      const marginOfError = 10; // milliseconds
      expect(Math.abs(result.session_expiry_time - expectedExpiry)).toBeLessThanOrEqual(marginOfError);
      expect(Math.abs(result.refresh_expiry_time - expectedExpiry)).toBeLessThanOrEqual(marginOfError);
    });
  });

  describe('isSessionExpired', () => {
    beforeAll(() => {
      global.window = {};
      global.window.localStorage = new LocalStorageMock();
    });

    beforeEach(() => {
      global.window.localStorage.clear();
      getAuthState.mockClear();
    });

    test('should return false if session time has not expired', async () => {
      const sessionExpiryTime = new Date().getTime() + 30 * 60 * 1000; // 30 minutes in the future
      expect(await isSessionExpired(sessionExpiryTime)).toBe(false);
    });

    test('should return true if session time has expired', async () => {
      const sessionExpiryTime = new Date().getTime() - 30 * 60 * 1000; // 30 minutes in the past
      expect(await isSessionExpired(sessionExpiryTime)).toBe(true);
    });

    test('should return true if sessionExpiryTime is null and checkSessionStatus returns null', async () => {
      getAuthState.mockReturnValue({ session_expiry_time: null });

      await expect(isSessionExpired(null)).resolves.toBe(true);
    });

    test('should return false if sessionExpiryTime is null and checkSessionStatus returns a future date', async () => {
      const checkedSessionExpiryTime = new Date().getTime() + 30 * 60 * 1000; // 30 minutes in the future
      getAuthState.mockReturnValue({ session_expiry_time: checkedSessionExpiryTime });

      await expect(isSessionExpired(null)).resolves.toBe(false);
    });

    test('should return true if sessionExpiryTime is null and checkSessionStatus returns a past date', async () => {
      const checkedSessionExpiryTime = new Date().getTime() - 30 * 60 * 1000; // 30 minutes in the past
      getAuthState.mockReturnValue({ session_expiry_time: checkedSessionExpiryTime });

      await expect(isSessionExpired(null)).resolves.toBe(true);
    });

    test('should throw an error if diffInSeconds is NaN', async () => {
      const sessionExpiryTime = 'invalid date';

      await expect(isSessionExpired(sessionExpiryTime)).rejects.toThrow(
        'encounted an error checking time interval: diffInSeconds is NaN',
      );
    });
  });

  describe('convertUTCToJSDate', () => {
    test('should convert valid UTC string to JS Date', () => {
      const utcString = '2024-12-31T23:59:59.000Z';
      const result = convertUTCToJSDate(utcString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(utcString);
    });

    test('should return null for invalid input', () => {
      expect(convertUTCToJSDate(null)).toBeNull();
      expect(convertUTCToJSDate(undefined)).toBeNull();
      expect(convertUTCToJSDate()).toBeNull();
    });
  });

  describe('checkSessionStatus', () => {
    beforeAll(() => {
      global.window = {};
      global.window.localStorage = new LocalStorageMock();
    });

    beforeEach(() => {
      global.window.localStorage.clear();
      getAuthState.mockClear();
    });

    test('should return session expiry time from auth state', async () => {
      const mockSessionExpiryTime = new Date().getTime() + 3600 * 1000; // 1 hour in the future
      const mockRefreshExpiryTime = new Date().getTime() + 7200 * 1000; // 2 hours in the future
      getAuthState.mockReturnValue({
        session_expiry_time: mockSessionExpiryTime,
        refresh_expiry_time: mockRefreshExpiryTime,
      });

      const result = await checkSessionStatus();
      expect(result).toEqual({
        checkedSessionExpiryTime: mockSessionExpiryTime,
        checkedRefreshExpiryTime: mockRefreshExpiryTime,
      });
    });

    test('should return session expiry time from access token in cookie', async () => {
      const mockRefreshExpiryTime = new Date().getTime() + 7200 * 1000; // 2 hours in the future
      getAuthState.mockReturnValue({
        refresh_expiry_time: mockRefreshExpiryTime,
      });
      const mockDecodedToken = { exp: Math.floor(Date.now() / 1000) + 3600 }; // 1 hour in the future
      const mockAccessToken = `header.${Buffer.from(JSON.stringify(mockDecodedToken)).toString('base64')}.signature`;
      document.cookie = `access_token=${mockAccessToken}`;

      const result = await checkSessionStatus();
      expect(result).toEqual({
        checkedSessionExpiryTime: new Date(mockDecodedToken.exp * 1000),
        checkedRefreshExpiryTime: mockRefreshExpiryTime,
      });
    });

    test('should return null if access token decoding fails', async () => {
      getAuthState.mockReturnValue(null);
      document.cookie = 'access_token=invalid-token';

      const result = await checkSessionStatus();
      expect(result).toEqual({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });
    });

    test('should return null if no session expiry time is found', async () => {
      getAuthState.mockReturnValue(null);
      document.cookie = null;

      const result = await checkSessionStatus();
      expect(result).toEqual({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });
    });
  });

  describe('renewSession', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should send session renewal request and return data on success', async () => {
      const mockBody = { test: 'data' };
      const mockResponse = { expirationTime: '2024-12-31T23:59:59.000Z' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await renewSession(mockBody);
      expect(fetch).toHaveBeenCalledWith(apiConfig.RENEW_SESSION, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'internal-token': 'FD0108EA-825D-411C-9B1D-41EF7727F465',
        },
        body: JSON.stringify(mockBody),
      });
      expect(result).toEqual(mockResponse);
    });

    test('should throw an error on failed session renewal', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(renewSession({})).rejects.toThrow('Failed to renew session');
    });
  });
});
