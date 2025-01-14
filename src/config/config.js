export const defaultConfig = {
  timeOffsets: {
    passiveRenewal: 300000,
  },
  onRenewSuccess: (sessionExpiryTime, refreshExpiryTime) => console.log(
    `[LIBRARY] Session renewed successfully. Session: ${sessionExpiryTime} and refresh: ${refreshExpiryTime}`,
  ),
  onRenewFailure: () => console.warn('[LIBRARY] Session renewal failed'),
  onSessionValid: (sessionExpiryTime, refreshExpiryTime) => console.log(
    `[LIBRARY] Session Valid. Session: ${sessionExpiryTime} and refresh: ${refreshExpiryTime}`,
  ),
  onSessionInvalid: () => console.warn('[LIBRARY] Session is invalid'),
  onError: (error) => console.error('[LIBRARY] Error:', error),
};

export const apiConfig = {
  RENEW_SESSION: '/tokens/self',
};
