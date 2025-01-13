// session-management.test.js

import SessionManagement from './session-management.js';
import { defaultConfig } from '../config/config.js';
import {
  checkSessionStatus, renewSession, convertUTCToJSDate,
} from '../utils/utils.js';
import { getAuthState } from '../utils/auth.js';

jest.useFakeTimers();
jest.mock('../utils/auth.js', () => ({
  getAuthState: jest.fn(),
  removeAuthState: jest.fn(),
  updateAuthState: jest.fn(),
  getCookieByName: jest.fn(),
}));

jest.mock('../utils/utils.js', () => ({
  checkSessionStatus: jest.fn(),
  renewSession: jest.fn(),
  convertUTCToJSDate: jest.fn(),
}));

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

describe('SessionManagement', () => {
  let mockConfig;
  let mockOnSessionValid;
  let mockOnSessionInvalid;
  let mockOnRenewSuccess;
  let mockOnRenewFailure;

  beforeAll(() => {
    global.document = {
      dispatchEvent: jest.fn(),
      cookie: '',
    };
    global.window = {};
    global.window.localStorage = new LocalStorageMock();
  });

  beforeEach(() => {
    mockOnSessionValid = jest.fn();
    mockOnSessionInvalid = jest.fn();
    mockOnRenewSuccess = jest.fn();
    mockOnRenewFailure = jest.fn();

    global.document = {
      ...global.document,
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
      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });

      SessionManagement.init(mockConfig);
      await SessionManagement.initialiseSessionExpiryTimers(
        new Date('2024-12-19T17:00:00.000Z'),
        new Date('2024-12-20T17:00:00.000Z'),
      );

      expect(mockOnSessionValid).toHaveBeenCalledWith(
        new Date('2024-12-19T17:00:00.000Z'),
        new Date('2024-12-20T17:00:00.000Z'),
      );
      expect(SessionManagement.timers).toHaveProperty('sessionTimerPassive');
    });

    test('should handle invalid session and call onSessionInvalid', async () => {
      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });

      SessionManagement.init(mockConfig);
      await SessionManagement.initialiseSessionExpiryTimers();

      expect(mockOnSessionInvalid).toHaveBeenCalled();
      expect(SessionManagement.timers).toEqual({});
    });

    test('should initialise with a valid config', () => {
      SessionManagement.init(mockConfig);
      expect(SessionManagement.config).toEqual(Object.freeze({ ...defaultConfig, ...mockConfig }));
    });

    test('should throw an error if invalid config is provided to init', () => {
      expect(() => {
        SessionManagement.init(null);
      }).toThrow('[LIBRARY] Invalid configuration object');
    });
  });

  describe('Timer Management', () => {
    test(
      'should not set timers if no sessionExpiryTime or refreshExpiryTime'
      + 'is provided and nothing returned from checkSessionStatus',
      async () => {
        checkSessionStatus.mockResolvedValue({
          checkedSessionExpiryTime: null,
          checkedRefreshExpiryTime: null,
        });

        await SessionManagement.setSessionExpiryTime();

        expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
        expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
      },
    );

    test('should set session timers when valid sessionExpiryTime and refreshExpiryTime are provided', async () => {
      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });

      const sessionExpiryTime = new Date('2024-12-19T17:00:00.000Z');
      const refreshExpiryTime = new Date('2024-12-20T17:00:00.000Z');

      SessionManagement.init(mockConfig);
      await SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);

      expect(SessionManagement.timers.sessionTimerPassive).toBeDefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeDefined();

      expect(mockOnSessionValid).toHaveBeenCalledWith(
        new Date('2024-12-19T17:00:00.000Z'),
        new Date('2024-12-20T17:00:00.000Z'),
      );
    });

    test('should remove all timers when removeTimers is called', () => {
      SessionManagement.timers.sessionTimerPassive = setTimeout(() => {}, 100000);
      SessionManagement.timers.refreshTimerPassive = setTimeout(() => {}, 100000);

      SessionManagement.removeTimers();

      expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
    });

    test('should set timers based on checkSessionStatus when no setSessionExpiryTime is provided', async () => {
      const checkedSessionExpiryTime = new Date('2024-12-21T17:00:00.000Z');
      const checkedRefreshExpiryTime = new Date('2024-12-22T17:00:00.000Z');

      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime,
        checkedRefreshExpiryTime,
      });

      await SessionManagement.setSessionExpiryTime();

      expect(SessionManagement.timers.sessionTimerPassive).toBeDefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeDefined();
    });

    test('should override setSessionExpiryTime with checkSessionStatus values', async () => {
      const sessionExpiryTime = new Date('2024-12-19T17:00:00.000Z');
      const refreshExpiryTime = new Date('2024-12-20T17:00:00.000Z');

      const checkedSessionExpiryTime = new Date('2024-12-21T17:00:00.000Z');
      const checkedRefreshExpiryTime = new Date('2024-12-22T17:00:00.000Z');

      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime,
        checkedRefreshExpiryTime,
      });

      SessionManagement.init(mockConfig);
      await SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);

      expect(SessionManagement.timers.sessionTimerPassive).toBeDefined();
      expect(SessionManagement.timers.refreshTimerPassive).toBeDefined();

      expect(mockOnSessionValid).toHaveBeenCalledWith(
        checkedSessionExpiryTime,
        checkedRefreshExpiryTime,
      );
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
      renewSession.mockResolvedValue({
        expirationTime: '2024-12-30T13:00:00+0000 UTC',
      });
      convertUTCToJSDate.mockReturnValue(new Date('2024-12-30T13:00:00.000Z'));
      getAuthState.mockReturnValue({ refresh_expiry_time: new Date('2024-12-30T12:00:00.000Z') });

      checkSessionStatus.mockResolvedValue({
        checkedSessionExpiryTime: null,
        checkedRefreshExpiryTime: null,
      });

      SessionManagement.init(mockConfig);
      await SessionManagement.refreshSession();

      expect(renewSession).toHaveBeenCalled();
      expect(mockOnRenewSuccess).toHaveBeenCalledWith(
        new Date('2024-12-30T13:00:00.000Z'),
        new Date('2024-12-30T12:00:00.000Z'),
      );
    });

    test('should call onRenewFailure when session renewal fails', async () => {
      renewSession.mockResolvedValue(null);

      SessionManagement.init(mockConfig);
      await SessionManagement.refreshSession();

      expect(renewSession).toHaveBeenCalled();
      expect(mockOnRenewFailure).toHaveBeenCalled();
    });

    test('should handle errors in the try-catch block and call onRenewFailure', async () => {
      const error = new Error('Session renewal failed');
      renewSession.mockRejectedValue(error);

      SessionManagement.init(mockConfig);
      await SessionManagement.refreshSession();

      expect(renewSession).toHaveBeenCalled();
      expect(mockOnRenewFailure).toHaveBeenCalledWith(error);
    });
  });
});
