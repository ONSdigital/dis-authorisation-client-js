// src/config/config.js
export const defaultConfig = {
  timeOffsets: {
    passiveRenewal: 300000,
  },
  onRenewSuccess: () => console.log('[LIBRARY] Session renewed successfully'),
  onRenewFailure: () => console.warn('[LIBRARY] Session renewal failed'),
  onSessionValid: (sessionExpiryTime) => console.log(`[LIBRARY] Session valid until: ${sessionExpiryTime}`),
  onSessionInvalid: () => console.warn('[LIBRARY] Session is invalid'),
  onError: (error) => console.error('[LIBRARY] Error:', error),
  checkSessionOnInit: false,
};

export const apiConfig = {
  RENEW_SESSION: '/tokens/self',
  CHECK_SESSION: '/tokens/self',
};
