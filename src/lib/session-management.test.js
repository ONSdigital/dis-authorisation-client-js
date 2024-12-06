// session-management.test.js

import SessionManagement from './session-management';
import defaultConfig from '../config/config';

jest.useFakeTimers(); // Mock timers for testing
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
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockOnSessionValid = jest.fn();
    mockOnSessionInvalid = jest.fn();
    mockOnRenewSuccess = jest.fn();
    mockOnRenewFailure = jest.fn();

    mockConfig = {
      ...defaultConfig,
      onSessionValid: mockOnSessionValid,
      onSessionInvalid: mockOnSessionInvalid,
      onRenewSuccess: mockOnRenewSuccess,
      onRenewFailure: mockOnRenewFailure,
    };

    SessionManagement.timers = {}; // Clear timers between tests
  });

  test('should initialise with valid session and call onSessionValid', async () => {
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
    const mockFetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    global.fetch = mockFetch;

    mockConfig.checkSessionOnInit = true;
    await SessionManagement.init(mockConfig);

    expect(mockFetch).toHaveBeenCalledWith('api/tokens/self', { method: 'GET' });
    expect(mockOnSessionInvalid).toHaveBeenCalled();
    expect(SessionManagement.timers).toEqual({});
  });

  test('should handle session refresh success and call onRenewSuccess', async () => {
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
    const mockFetch = jest.fn(() => Promise.resolve({
      ok: false,
      status: 500,
    }));
    global.fetch = mockFetch;

    await SessionManagement.init(mockConfig);
    await SessionManagement.refreshSession();

    expect(mockFetch).toHaveBeenCalled();
    expect(mockOnRenewFailure).toHaveBeenCalledWith(expect.any(Error));
  });

  test("when no times are given to the function setSessionExpiryTime it doesn't set any timers", () => {
    SessionManagement.setSessionExpiryTime();

    expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
    expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
  });

  test('when a valid sessionExpiryTime and refreshExpiryTime are given to the function setSessionExpiryTime it sets the session timers', async () => {
    await SessionManagement.init(mockConfig);
    let sessionExpiryTime = new Date();
    let refreshExpiryTime = new Date();
    sessionExpiryTime = sessionExpiryTime.setHours(sessionExpiryTime.getHours() + 1);
    refreshExpiryTime = refreshExpiryTime.setHours(refreshExpiryTime.getHours() + 24);
    // Convert time format to same that the server sends
    sessionExpiryTime = new Date(sessionExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');
    refreshExpiryTime = new Date(refreshExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');

    sessionExpiryTime = SessionManagement.convertUTCToJSDate(sessionExpiryTime);
    refreshExpiryTime = SessionManagement.convertUTCToJSDate(refreshExpiryTime);

    SessionManagement.setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime);
    expect(SessionManagement.timers.sessionTimerPassive).toBeDefined();
    expect(SessionManagement.timers.refreshTimerPassive).toBeDefined();
  });

  test('given timers exist and when timers are requested to be removed they are actually removed', () => {
    SessionManagement.timers.sessionTimerPassive = setTimeout(() => {}, 100000);
    SessionManagement.timers.refreshTimerPassive = setTimeout(() => {}, 100000);
    SessionManagement.removeTimers();
    expect(SessionManagement.timers.sessionTimerPassive).toBeUndefined();
    expect(SessionManagement.timers.refreshTimerPassive).toBeUndefined();
  });

  describe('isSessionExpired', () => {
    test('should return true if session UTC time from server has not expired', () => {
      let sessionExpiryTime = new Date();
      sessionExpiryTime = sessionExpiryTime.setHours(sessionExpiryTime.getHours() + 1);
      // Convert time format to same that the server sends
      sessionExpiryTime = new Date(sessionExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');
      const expirationTime = SessionManagement.convertUTCToJSDate(sessionExpiryTime);
      const actual = SessionManagement.isSessionExpired(expirationTime);
      const expected = false;
      expect(actual).toEqual(expected);
    });
    test('should return false if client created session time has expired', () => {
      let sessionExpiryTime = new Date();
      sessionExpiryTime = sessionExpiryTime.setHours(sessionExpiryTime.getHours() - 1);
      // Convert time format to same that the server sends
      sessionExpiryTime = new Date(sessionExpiryTime).toISOString().replace(/Z/, ' +0000 UTC');
      sessionExpiryTime = SessionManagement.convertUTCToJSDate(sessionExpiryTime);
      const actual = SessionManagement.isSessionExpired(sessionExpiryTime);
      const expected = true;
      expect(actual).toEqual(expected);
    });
    test('should return true if client created session time has not expired', () => {
      const seconds30 = 30 * 60 * 1000;
      const sessionExpiryTime = new Date().getTime() + seconds30;
      const actual = SessionManagement.isSessionExpired(sessionExpiryTime);
      const expected = false;
      expect(actual).toEqual(expected);
    });
    test('should return true if session time does not exist', () => {
      const sessionExpiryTime = null;
      const actual = SessionManagement.isSessionExpired(sessionExpiryTime);
      const expected = true;
      expect(actual).toEqual(expected);
    });
  });
});
