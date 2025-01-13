// utils.test.js
import {
  createDefaultExpireTimes,
  checkSessionStatus,
  renewSession,
  isSessionExpired,
  convertUTCToJSDate,
} from './utils.js';
import { getAuthState } from './auth.js';
import { apiConfig } from '../config/config.js';

// Mock localStorage
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

jest.mock('../config/config.js', () => ({
  apiConfig: {
    CHECK_SESSION: 'mock-check-session-url',
  },
}));

jest.mock('./auth.js', () => ({
  getAuthState: jest.fn(),
}));

describe('Utils', () => {
  beforeEach(() => {
    global.window = {};
    global.window.localStorage = new LocalStorageMock();
    global.document = {};

    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'access_token=eyJraWQiOiJqeFlva3pnVER5UVVNb1VTM0c0ODNoa0VjY3hFSklKdCtHVjAraHVSRUpBPSIsImFsZyI6IlJTMjU2In0.eyJzdWIiOiI5NmM2NDcxOS05YWFlLTQ3ZjktYjQ3Zi1lYjM5MzZhMzcxZmQiLCJjb2duaXRvOmdyb3VwcyI6WyJyb2xlLWFkbWluIiwicm9sZS1wdWJsaXNoZXIiXSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LXdlc3QtMi5hbWF6b25hd3MuY29tXC9ldS13ZXN0LTJfV1NEOUVjQXN3IiwiY2xpZW50X2lkIjoiNGV2bDkxZzR0czVpc211ZGhyY2JiNGRhb2MiLCJvcmlnaW5fanRpIjoiMWQ1N2UwMjAtYTgwMC00YWU0LWFiOTQtNTg2YzU5ZjRkMWQxIiwiZXZlbnRfaWQiOiJlMWYxMzM5My04MmJjLTQ3MzgtOWUxMy03MDg2ZGNiN2JjNDkiLCJ0b2tlbl91c2UiOiJhY2Nlc3MiLCJzY29wZSI6ImF3cy5jb2duaXRvLnNpZ25pbi51c2VyLmFkbWluIiwiYXV0aF90aW1lIjoxNzM0NjI2MjY4LCJleHAiOjE3MzQ2Mjk5MjYsImlhdCI6MTczNDYyOTAyNiwianRpIjoiMDYzODBmZWMtZTVmNi00ODA4LWIyYzktNjYyMzYxNzA3MmE5IiwidXNlcm5hbWUiOiJhZTAwOTliOC01OTFhLTQ0ZGUtYTllOS1kNjY4ZmU5YzRhZWIifQ.g8VxNWnB5AtcOg1w11hDhzb5a1kZQVIe5ADxtpb_Uqd2yKo_ibwlHUidgEzMu2ezYhrmwPa9ya6zb1hn0k5T0wZBBcv_CFHYBHj_L-yizQzPruc7grgbAVK5QouPM3-1anb5IcRq3sHbbazEGWZPIpBnY704yvI7oESaWg_mBTpMbinBZDaBXrHfrt0iodmUhzLuqbAdkXBfN3vQyfQC0xSX3g0S4_U2wOZTpvtakNMWv78eHXW4R8ktbpfKiuQqdzvGqksmio0JHb_PCrvSebUZjmiysROtSayihbjXqWSwY91JqN_UjC5iCu5F7h_Iz0Volr6u9kUrriJYT3DdFw',
    });
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
  
      // global.document = {};
      // Object.defineProperty(global.document, 'cookie', {
      //   writable: true,
      //   value: 'access_token=mockAccessToken',
      // });
    });
  
    beforeEach(() => {
      global.window.localStorage.clear();
      // global.document.cookie = 'access_token=mockAccessToken';
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

    // test('should return true if sessionExpiryTime is null', async () => {
    //   expect(await isSessionExpired(null)).toBe(true);
    // });

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
      
      await expect(isSessionExpired(sessionExpiryTime)).rejects.toThrow('encounted an error checking time interval: diffInSeconds is NaN');
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
    document.cookie = `access_token=invalid-token`;

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
          "internal-token": "FD0108EA-825D-411C-9B1D-41EF7727F465",
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
