import fp from 'lodash/fp.js';
import { apiConfig } from '../config/config.js';
import { getAuthState } from './auth.js';

export function createDefaultExpireTimes(hours) {
  console.log('[LIBRARY] Creating default expire times for', hours, 'hours');
  const now = new Date();
  const expiry = now.setHours(now.getHours() + hours);
  return {
    session_expiry_time: new Date(expiry),
    refresh_expiry_time: new Date(expiry),
  };
}

function getCookieByName(name) {
  console.log('[LIBRARY] Getting cookie by name:', name);
  console.log('[LIBRARY] Cookies:', document.cookie);
  const cookies = document.cookie;
  if (!cookies) {
    return null;
  }
  const cookie = cookies.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.substring(name.length + 1) : null;
}

export async function checkSessionStatus() {
  console.log('[LIBRARY] Checking initial session status');
  const authState = getAuthState();
  const sessionExpiryTime = fp.get('session_expiry_time')(authState);
  const refreshExpiryTime = fp.get('refresh_expiry_time')(authState);

  if (sessionExpiryTime) {
    console.log('[LIBRARY] Initial session status:', sessionExpiryTime);
    return { checkedSessionExpiryTime: sessionExpiryTime, checkedRefreshExpiryTime: refreshExpiryTime };
  }
  // Check cookie data for access token
  const accessToken = getCookieByName('access_token');
  if (accessToken) {
    try {
      console.log('[LIBRARY] Decoding access token:', accessToken);
      const decodedToken = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
      console.log('[LIBRARY] Decoded access token:', decodedToken);
      const expirationTime = new Date(decodedToken.exp * 1000);
      console.log('[LIBRARY] Initial session status from access token:', expirationTime);
      return { checkedSessionExpiryTime: expirationTime, checkedRefreshExpiryTime: refreshExpiryTime };
    } catch (error) {
      console.error('[LIBRARY] Failed to decode access token:', error);
      return { checkedSessionExpiryTime: null, checkedRefreshExpiryTime: null };
    }
  }

  return { checkedSessionExpiryTime: null, checkedRefreshExpiryTime: null };
}

export async function renewSession(body) {
  console.log('[LIBRARY] Starting session renewal process: ', body);
  const response = await fetch(apiConfig.RENEW_SESSION, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'internal-token': 'FD0108EA-825D-411C-9B1D-41EF7727F465',
    },
    body: JSON.stringify(body),
  });

  console.log(`[LIBRARY] Fetch request sent to ${apiConfig.RENEW_SESSION}:`, response);

  if (!response.ok) {
    console.error('[LIBRARY] Failed to renew session, response status:', response.status);
    throw new Error('Failed to renew session');
  }

  const data = await response.json();
  console.log('[LIBRARY] Session renewed successfully, response data:', data);

  return data;
}

export async function isSessionExpired(expiryTime) {
  let sessionExpiryTime = expiryTime;
  console.log('[IS SESSION EXPIRED] start sessionExpiryTime: ', sessionExpiryTime);
  if (sessionExpiryTime == null) {
    const { checkedSessionExpiryTime } = await checkSessionStatus();
    if (checkedSessionExpiryTime == null) {
      return true;
    }
    sessionExpiryTime = checkedSessionExpiryTime;
  }
  console.log('[IS SESSION EXPIRED] sessionExpiryTime: ', sessionExpiryTime);
  const now = new Date();
  const nowUTCInMS = now.getTime() + now.getTimezoneOffset() * 60000;
  const nowInUTC = new Date(nowUTCInMS);
  console.log('[IS SESSION EXPIRED] nowInUTC: ', nowInUTC);
  console.log('[IS SESSION EXPIRED] sessionExpiryTime: ', new Date(sessionExpiryTime));
  // Get the time difference between now and the expiry time minus the timer offset
  const timerInterval = new Date(sessionExpiryTime) - nowInUTC;
  console.log('[IS SESSION EXPIRED] timerInterval: ', timerInterval);
  const diffInSeconds = Math.round(timerInterval / 1000);
  console.log('[IS SESSION EXPIRED] diff: ', diffInSeconds);
  if (Number.isNaN(diffInSeconds)) {
    throw new Error('encounted an error checking time interval: diffInSeconds is NaN');
  }
  if (diffInSeconds <= 0) {
    return true;
  }
  return false;
}

export function convertUTCToJSDate(expiryTime) {
  console.log('[LIBRARY] UTC to JS date: ', expiryTime);
  if (expiryTime) {
    const expireTimeInUTCString = expiryTime.replace(' +0000 UTC', 'Z');
    console.log('[LIBRARY] UTC to JS date: ', expireTimeInUTCString);
    return new Date(expireTimeInUTCString);
  }
  return null;
}
