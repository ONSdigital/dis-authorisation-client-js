const defaultConfig = {
  timeOffsets: {
    passiveRenewal: 300000,
  },
  onRenewSuccess: (sessionExpiryTime, refreshExpiryTime) => console.debug(
    `[LIBRARY] Session renewed successfully. Session: ${sessionExpiryTime} and refresh: ${refreshExpiryTime}`,
  ),
  onRenewFailure: () => console.warn('[LIBRARY] Session renewal failed'),
  onSessionValid: (sessionExpiryTime, refreshExpiryTime) => console.debug(
    `[LIBRARY] Session Valid. Session: ${sessionExpiryTime} and refresh: ${refreshExpiryTime}`,
  ),
  onSessionInvalid: () => console.warn('[LIBRARY] Session is invalid'),
  onError: (error) => console.error('[LIBRARY] Error:', error),
  apiEndpoints: {
    renewSession: '/api/v1/tokens/self',
  },
};

export default defaultConfig;
