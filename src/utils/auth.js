export const AUTH_STATE_NAME = 'ons_auth_state';

export function setAuthState(userData = {}) {
  console.log('[STORAGE] Setting auth state');
  const authState = getAuthState() || {};
  const userJSONData = JSON.stringify({ ...authState, ...userData });
  window.localStorage.setItem(AUTH_STATE_NAME, userJSONData);
  console.log('[STORAGE] Auth state set:', userJSONData);
}

export function updateAuthState(data = {}) {
  console.log('[STORAGE] Updating auth state');
  let authState = getAuthState() || {};
  authState = { ...authState, ...data };
  const authStateJSON = JSON.stringify(authState);
  window.localStorage.setItem(AUTH_STATE_NAME, authStateJSON);
  console.log('[STORAGE] Auth state updated:', authStateJSON);
}

/** Assumes user is authenticated if dis_auth_client_state exists in local storage */
export function getAuthState() {
  console.log('[STORAGE] Getting auth state');
  let userData = window.localStorage.getItem(AUTH_STATE_NAME);
  try {
    userData = JSON.parse(userData);
    console.log('[STORAGE] Auth state retrieved:', userData);
  } catch (err) {
    console.error('[STORAGE] Could not parse auth token from local storage:', err);
    return undefined;
  }
  return userData;
}

export function removeAuthState() {
  console.log('[STORAGE] Removing auth state');
  window.localStorage.removeItem(AUTH_STATE_NAME);
  console.log('[STORAGE] Auth state removed');
}
