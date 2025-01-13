import {
  AUTH_STATE_NAME,
  setAuthState,
  updateAuthState,
  getAuthState,
  removeAuthState,
} from './auth.js';

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

describe('auth.js', () => {
  beforeAll(() => {
    global.window = {};
    global.window.localStorage = new LocalStorageMock();
  });

  beforeEach(() => {
    global.window.localStorage.clear();
  });

  describe('setAuthState', () => {
    test('should set auth state in localStorage', () => {
      const userData = { user: 'testUser' };
      setAuthState(userData);

      const storedData = JSON.parse(global.window.localStorage.getItem(AUTH_STATE_NAME));
      expect(storedData).toEqual(userData);
    });

    test('should merge with existing auth state', () => {
      const initialData = { user: 'initialUser' };
      const newData = { token: 'newToken' };

      setAuthState(initialData);
      setAuthState(newData);

      const storedData = JSON.parse(global.window.localStorage.getItem(AUTH_STATE_NAME));
      expect(storedData).toEqual({ user: 'initialUser', token: 'newToken' });
    });
  });

  describe('updateAuthState', () => {
    test('should update auth state in localStorage', () => {
      const initialData = { user: 'initialUser' };
      const updateData = { token: 'updatedToken' };

      setAuthState(initialData);
      updateAuthState(updateData);

      const storedData = JSON.parse(global.window.localStorage.getItem(AUTH_STATE_NAME));
      expect(storedData).toEqual({ user: 'initialUser', token: 'updatedToken' });
    });

    test('should create auth state if none exists', () => {
      const updateData = { token: 'updatedToken' };

      updateAuthState(updateData);

      const storedData = JSON.parse(global.window.localStorage.getItem(AUTH_STATE_NAME));
      expect(storedData).toEqual({ token: 'updatedToken' });
    });
  });

  describe('getAuthState', () => {
    test('should return auth state from localStorage', () => {
      const userData = { user: 'testUser' };
      setAuthState(userData);

      const authState = getAuthState();
      expect(authState).toEqual(userData);
    });

    test('should return undefined if auth state is not valid JSON', () => {
      global.window.localStorage.setItem(AUTH_STATE_NAME, 'invalidJSON');

      const authState = getAuthState();
      expect(authState).toBeUndefined();
    });

    test('should return null if auth state does not exist', () => {
      const authState = getAuthState();
      expect(authState).toBeNull();
    });
  });

  describe('removeAuthState', () => {
    test('should remove auth state from localStorage', () => {
      const userData = { user: 'testUser' };
      setAuthState(userData);

      removeAuthState();

      const storedData = global.window.localStorage.getItem(AUTH_STATE_NAME);
      expect(storedData).toBeNull();
    });
  });
});
