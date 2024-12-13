// session-management.test.js

import SessionManagement from './session-management.js';
import { defaultConfig, apiConfig } from '../config/config.js';
import {
  convertUTCToJSDate,
} from '../utils/utils.js';

jest.useFakeTimers();

describe('SessionManagement', () => {
  let mockConfig;
  let mockOnSessionValid;
  let mockOnSessionInvalid;
  let mockOnRenewSuccess;
  let mockOnRenewFailure;

  beforeAll(() => {
    global.document = {
      dispatchEvent: jest.fn(),
    };
  });

  beforeEach(() => {
    mockOnSessionValid = jest.fn();
    mockOnSessionInvalid = jest.fn();
    mockOnRenewSuccess = jest.fn();
    mockOnRenewFailure = jest.fn();

    global.document = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    mockConfig = {
      ...defaultConfig,
      onSessionValid: mockOnSessionValid,
      onSessionInvalid: mockOnSessionInvalid,
      onRenewSuccess: mockOnRenewSuccess,
      onRenewFailure: mockOnRenewFailure,
    };

    SessionManagement.timers = {};
  });

  describe('Initialisation', () => {
    test('should initialise with a valid session and call onSessionValid', async () => {
      const mockFetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ expirationTime: '2024-12-30T23:59:59Z' }),
      }));
      global.fetch = mockFetch;

      mockConfig.checkSessionOnInit = true;
      await SessionManagement.init(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith(apiConfig.CHECK_SESSION, { method: 'GET' });
      expect(mockOnSessionValid).toHaveBeenCalledWith('2024-12-30T23:59:59Z');
      expect(SessionManagement.timers).toHaveProperty('sessionTimerPassive');
    });

    test('should handle invalid session and call onSessionInvalid', async () => {
      const mockFetch = jest.fn(() => Promise.resolve({
        ok: true, json: () => Promise.resolve({}),
      }));
      global.fetch = mockFetch;

      mockConfig.checkSessionOnInit = true;
      await SessionManagement.init(mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(apiConfig.CHECK_SESSION, { method: 'GET' });
      expect(mockOnSessionInvalid).toHaveBeenCalled();
      expect(SessionManagement.timers).toEqual({});
    });

    test('should throw an error if invalid config is provided to init', async () => {
      await expect(SessionManagement.init(null)).rejects.toThrow('[LIBRARY] Invalid configuration object');
    });
  });

  describe('Timer Management', () => {
    test('should not set timers if no sessionExpiryTime or refreshExpiryTime is provided', () => {
      SessionManagement.setSessionExpiryTime();

      expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
    });

    test('should set session timers when valid sessionExpiryTime and refreshExpiryTime are provided', () => {
      let sessionExpiryTime = new Date().setHours(new Date().getHours() + 1);
      let refreshExpiryTime = new Date().setHours(new Date().getHours() + 24);
      sessionExpiryTime = new Date(sessionExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');
      refreshExpiryTime = new Date(refreshExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');

      sessionExpiryTime = convertUTCToJSDate(sessionExpiryTime);
      refreshExpiryTime = convertUTCToJSDate(refreshExpiryTime);

      SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);
      expect(SessionManagement.timers.sessionTimerPassive).toBeDefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeDefined();
    });

    test('should remove all timers when removeTimers is called', () => {
      SessionManagement.timers.sessionTimerPassive = setTimeout(() => {}, 100000);
      SessionManagement.timers.refreshTimerPassive = setTimeout(() => {}, 100000);

      SessionManagement.removeTimers();
      expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
    });
  });

  describe('Session Monitoring', () => {
    test('should add event listeners when monitorInteraction is called', () => {
      SessionManagement.monitorInteraction();

      expect(document.addEventListener).toHaveBeenCalledTimes(
        SessionManagement.eventsToMonitor.length,
      );
      SessionManagement.eventsToMonitor.forEach((event) => {
        expect(document.addEventListener).toHaveBeenCalledWith(event, SessionManagement.refreshSession);
      });
    });

    test('should remove event listeners when removeInteractionMonitoring is called', () => {
      SessionManagement.monitorInteraction();
      SessionManagement.removeInteractionMonitoring();

      expect(document.removeEventListener).toHaveBeenCalledTimes(
        SessionManagement.eventsToMonitor.length,
      );
      SessionManagement.eventsToMonitor.forEach((event) => {
        expect(document.removeEventListener).toHaveBeenCalledWith(event, SessionManagement.refreshSession);
      });
    });
  });

  describe('Session Renewal', () => {
    test('should handle successful session renewal and call onRenewSuccess', async () => {
      const mockFetch = jest.fn(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ expirationTime: '2024-12-31T23:59:59.000Z' }),
      }));
      global.fetch = mockFetch;

      await SessionManagement.init(mockConfig);
      await SessionManagement.refreshSession();
      expect(mockFetch).toHaveBeenCalledWith(apiConfig.RENEW_SESSION, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(undefined),
      });
      expect(mockOnRenewSuccess).toHaveBeenCalled();
      expect(mockOnRenewSuccess).toHaveBeenCalledWith(new Date('2024-12-31T23:59:59.000Z'));
    });

    test('should call onRenewFailure when session renewal fails', async () => {
      const mockFetch = jest.fn(() => Promise.resolve({ ok: false, status: 500 }));
      global.fetch = mockFetch;

      await SessionManagement.init(mockConfig);
      await SessionManagement.refreshSession();

      expect(mockFetch).toHaveBeenCalled();
      expect(mockOnRenewFailure).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
