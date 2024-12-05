// src/config/config.js
const defaultConfig = {
  timeOffsets: {
    passiveRenewal: 2000,
    invasiveRenewal: 3000,
  },
  onRenewSuccess: () => console.log('[LIBRARY] Session renewed successfully'),
  onRenewFailure: () => console.warn('[LIBRARY] Session renewal failed'),
  onSessionValid: (sessionExpiryTime) => console.log(`[LIBRARY] Session valid until: ${sessionExpiryTime}`),
  onSessionInvalid: () => console.warn('[LIBRARY] Session is invalid'),
  onError: (error) => console.error('[LIBRARY] Error:', error),
  checkSessionOnInit: false,
};

export default defaultConfig;
