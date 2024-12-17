// utils.test.js
import {
  createDefaultExpireTimes,
  checkSessionStatus,
  renewSession,
  isSessionExpired,
  convertUTCToJSDate,
} from './utils.js';
import { apiConfig } from '../config/config.js';

jest.mock('../config/config.js', () => ({
  apiConfig: {
    CHECK_SESSION: 'mock-check-session-url',
    RENEW_SESSION: 'mock-renew-session-url',
  },
}));

describe('Utils', () => {
  describe('createDefaultExpireTimes', () => {
    test('should create valid session and refresh expiry times', () => {
      const hours = 5;
      const result = createDefaultExpireTimes(hours);

      const now = new Date();
      const expectedExpiry = new Date(now.setHours(now.getHours() + hours));

      expect(result).toHaveProperty('session_expiry_time');
      expect(result).toHaveProperty('refresh_expiry_time');
      expect(result.session_expiry_time).toEqual(expectedExpiry);
      expect(result.refresh_expiry_time).toEqual(expectedExpiry);
    });
  });

  describe('isSessionExpired', () => {
    test('should return false if session time has not expired', () => {
      const sessionExpiryTime = new Date().getTime() + 30 * 60 * 1000; // 30 minutes in the future
      expect(isSessionExpired(sessionExpiryTime)).toBe(false);
    });

    test('should return true if session time has expired', () => {
      const sessionExpiryTime = new Date().getTime() - 30 * 60 * 1000; // 30 minutes in the past
      expect(isSessionExpired(sessionExpiryTime)).toBe(true);
    });

    test('should return true if sessionExpiryTime is null', () => {
      expect(isSessionExpired(null)).toBe(true);
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
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    test('should fetch session status and return data on success', async () => {
      const mockResponse = { expirationTime: '2024-12-31T23:59:59.000Z' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await checkSessionStatus();
      expect(fetch).toHaveBeenCalledWith(apiConfig.CHECK_SESSION, { method: 'GET' });
      expect(result).toEqual(mockResponse);
    });

    test('should throw an error on failed fetch', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false });

      await expect(checkSessionStatus()).rejects.toThrow('Failed to check session status');
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
        headers: { 'Content-Type': 'application/json' },
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
