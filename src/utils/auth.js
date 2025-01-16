export const AUTH_STATE_NAME = 'dis_auth_client_state';

export function getAuthState() {
  let userData = window.localStorage.getItem(AUTH_STATE_NAME);
  try {
    userData = JSON.parse(userData);
  } catch (err) {
    console.error('[STORAGE] Could not parse session timers from local storage:', err);
    return undefined;
  }
  return userData;
}

export function setAuthState(userData = {}) {
  const authState = getAuthState() || {};
  const userJSONData = JSON.stringify({ ...authState, ...userData });
  window.localStorage.setItem(AUTH_STATE_NAME, userJSONData);
}

export function updateAuthState(data = {}) {
  let authState = getAuthState() || {};
  authState = { ...authState, ...data };
  const authStateJSON = JSON.stringify(authState);
  window.localStorage.setItem(AUTH_STATE_NAME, authStateJSON);
}

export function removeAuthState() {
  window.localStorage.removeItem(AUTH_STATE_NAME);
}
