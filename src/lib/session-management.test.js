// session-management.test.js

import SessionManagement from './session-management';
import defaultConfig from '../config/config';

jest.useFakeTimers();
jest.mock('../config/config', () => ({
  timeOffsets: {
    passiveRenewal: 2000,
    intrusiveRenewal: 1000,
  },
  checkSessionOnInit: false,
}));

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
    // Reset mocks before each test
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

    SessionManagement.timers = {}; // Clear timers between tests
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
      expect(mockFetch).toHaveBeenCalledWith('api/tokens/self', { method: 'GET' });
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

      expect(mockFetch).toHaveBeenCalledWith('api/tokens/self', { method: 'GET' });
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

      sessionExpiryTime = SessionManagement.convertUTCToJSDate(sessionExpiryTime);
      refreshExpiryTime = SessionManagement.convertUTCToJSDate(refreshExpiryTime);

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

      expect(mockFetch).toHaveBeenCalledWith('api/tokens/self', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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

  describe('Session Expiry Check', () => {
    test('should return false if session time has not expired', () => {
      const sessionExpiryTime = new Date().getTime() + 30 * 60 * 1000; // 30 minutes in the future
      expect(SessionManagement.isSessionExpired(sessionExpiryTime)).toBe(false);
    });

    test('should return true if session time has expired', () => {
      const sessionExpiryTime = new Date().getTime() - 30 * 60 * 1000; // 30 minutes in the past
      expect(SessionManagement.isSessionExpired(sessionExpiryTime)).toBe(true);
    });

    test('should return true if sessionExpiryTime is null', () => {
      expect(SessionManagement.isSessionExpired(null)).toBe(true);
    });
  });
});
