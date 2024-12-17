import { apiConfig } from '../config/config.js';

export function createDefaultExpireTimes(hours) {
  console.log('[LIBRARY] Creating default expire times for', hours, 'hours');
  const now = new Date();
  const expiry = now.setHours(now.getHours() + hours);
  return {
    session_expiry_time: new Date(expiry),
    refresh_expiry_time: new Date(expiry),
  };
}

export async function checkSessionStatus() {
  console.log('[LIBRARY] Checking initial session status');
  const response = await fetch(apiConfig.CHECK_SESSION, { method: 'GET' });

  if (response.ok) {
    const data = await response.json();
    console.log('[LIBRARY] Initial session status:', data);
    return data;
  }
  throw new Error('Failed to check session status');
}

export async function renewSession(body) {
  console.log('[LIBRARY] Starting session renewal process');
  const response = await fetch(apiConfig.RENEW_SESSION, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  console.log('[LIBRARY] Fetch request sent to /tokens/self: ', response);

  if (!response.ok) {
    console.error('[LIBRARY] Failed to renew session, response status:', response.status);
    throw new Error('Failed to renew session');
  }

  const data = await response.json();
  console.log('[LIBRARY] Session renewed successfully, response data:', data);

  return data;
}

export function isSessionExpired(sessionExpiryTime) {
  if (sessionExpiryTime == null) {
    return true;
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
  if (expiryTime) {
    const expireTimeInUTCString = expiryTime.replace(' +0000 UTC', 'Z');
    console.log('[LIBRARY] UTC to JS date: ', expireTimeInUTCString);
    return new Date(expireTimeInUTCString);
  }
  return null;
}
