import fp from 'lodash/fp.js';
import { defaultConfig } from '../config/config.js';
import {
  checkSessionStatus, renewSession, convertUTCToJSDate,
} from '../utils/utils.js';
import { updateAuthState, getAuthState, removeAuthState } from '../utils/auth.js';

class SessionManagement {
  static instance;

  constructor() {
    if (SessionManagement.instance) {
      throw new Error('Use SessionManagement.getInstance() to get the single instance of this class.');
    }

    this.config = {};
    this.timers = {};
    this.eventsToMonitor = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    // Bind methods to the instance
    this.refreshSession = this.refreshSession.bind(this);
    this.monitorInteraction = this.monitorInteraction.bind(this);
    this.removeInteractionMonitoring = this.removeInteractionMonitoring.bind(this);

    SessionManagement.instance = this;
  }

  static getInstance() {
    if (!SessionManagement.instance) {
      SessionManagement.instance = new SessionManagement();
    }
    return SessionManagement.instance;
  }

  init(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('[LIBRARY] Invalid configuration object');
    }
    this.config = Object.freeze({ ...defaultConfig, ...config });
    console.log('[LIBRARY] Initialising session management with config:', this.config);
  }

  setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime) {
    console.log('[LIBRARY] Setting session expiry time');
    this.initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime);
  }

  async initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime) {
    console.log('[LIBRARY] init config: ', this.config);
    if (!this.config || Object.keys(this.config).length === 0) {
      console.log('[LIBRARY] No config found, initialising with default config');
      this.init(this.config);
    }

    try {
      console.log('[LIBRARY] Checking initial session state');
      const { checkedSessionExpiryTime, checkedRefreshExpiryTime } = await checkSessionStatus();

      const finalSessionExpiryTime = checkedSessionExpiryTime || sessionExpiryTime;
      const finalRefreshExpiryTime = checkedRefreshExpiryTime || refreshExpiryTime;

      console.log('[LIBRARY] sessionExpiryTime: ', finalSessionExpiryTime);
      console.log('[LIBRARY] refreshExpiryTime: ', finalRefreshExpiryTime);

      if (finalSessionExpiryTime) {
        console.log(`[LIBRARY] Session expiry time: ${finalSessionExpiryTime}`);
        this.startSessionTimer(finalSessionExpiryTime);
      }
      if (finalRefreshExpiryTime) {
        console.log(`[LIBRARY] Refresh expiry time: ${finalRefreshExpiryTime}`);
        this.startRefreshTimer(finalRefreshExpiryTime);
      }
      if (!finalSessionExpiryTime && !finalRefreshExpiryTime) {
        console.error('[LIBRARY] Failed to initialise session expiry timers: No expiry times provided');
        this.handleSessionInvalid();
      } else {
        this.handleSessionValid(finalSessionExpiryTime, finalRefreshExpiryTime);
      }
    } catch (error) {
      console.error('[LIBRARY] Failed to initialise session expiry timers:', error);
      this.handleSessionInvalid();
    }
  }

  handleSessionValid(sessionExpiryTime, refreshExpiryTime) {
    if (this.config.onSessionValid) {
      this.config.onSessionValid(sessionExpiryTime, refreshExpiryTime);
    }
  }

  handleSessionInvalid() {
    if (this.config.onSessionInvalid) {
      this.config.onSessionInvalid();
    }
  }

  startSessionTimer(sessionExpiryTime) {
    updateAuthState({ session_expiry_time: sessionExpiryTime });
    this.startExpiryTimer(
      'sessionTimerPassive',
      sessionExpiryTime,
      this.monitorInteraction,
    );
  }

  startRefreshTimer(refreshExpiryTime) {
    updateAuthState({ refresh_expiry_time: refreshExpiryTime });
    this.startExpiryTimer(
      'refreshTimerPassive',
      refreshExpiryTime,
      this.monitorInteraction,
    );
  }

  startExpiryTimer(name, expiryTime, callback) {
    console.log(`[LIBRARY] Expiry time for ${name}: ${expiryTime}`);
    if (expiryTime) {
      const now = new Date();
      const timerInterval = new Date(expiryTime) - now.getTime() - this.config.timeOffsets.passiveRenewal;
      console.log(`[LIBRARY] Offset for ${name}: ${this.config.timeOffsets.passiveRenewal}`);
      if (Number.isNaN(timerInterval)) {
        console.error(`[LIBRARY] time interval for ${name} is not a valid date format: ${timerInterval}`);
        return;
      }
      if (this.timers[name] != null) {
        clearTimeout(this.timers[name]);
      }
      console.log(`[LIBRARY] Interval for ${name} set to ${timerInterval}`);
      this.timers[name] = setTimeout(callback, timerInterval);
    }
  }

  monitorInteraction() {
    console.log('[LIBRARY] Event listeners added: ', this.eventsToMonitor);
    this.eventsToMonitor.forEach((name) => {
      document.addEventListener(name, this.refreshSession);
    });
  }

  removeInteractionMonitoring() {
    console.log('[LIBRARY] Removing interaction monitoring');
    this.eventsToMonitor.forEach((name) => {
      document.removeEventListener(name, this.refreshSession);
    });
  }

  async refreshSession() {
    console.log('[LIBRARY] Refreshing session');
    this.removeInteractionMonitoring();
    const renewError = (error) => {
      console.log("[LIBRARY] an unexpected error has occurred when extending the user's session: ", error);
      if (error != null) {
        console.error(error);
        if (this.config.onRenewFailure) {
          this.config.onRenewFailure(error);
        }
      }
    };
    try {
      const response = await renewSession();
      if (response) {
        let expirationTime = fp.get('expirationTime')(response);
        console.log(
          '[LIBRARY] Session renewed successfully, new expiration time:',
          expirationTime,
        );
        expirationTime = convertUTCToJSDate(expirationTime);
        console.log(
          '[LIBRARY] Session renewed successfully, new converted expiration time:',
          expirationTime,
        );
        this.startSessionTimer(expirationTime);
        if (this.config.onRenewSuccess) {
          const refreshExpiryTime = fp.get('refresh_expiry_time')(getAuthState());
          this.config.onRenewSuccess(expirationTime, refreshExpiryTime);
        }
      } else {
        renewError('Session renewal failed');
      }
    } catch (error) {
      renewError(error);
    }
  }

  removeTimers() {
    this.removeInteractionMonitoring();
    Object.values(this.timers).forEach((timer) => {
      clearTimeout(timer);
    });
    removeAuthState();
    this.timers = {};
  }
}

// Export a single instance of SessionManagement
const sessionManagementInstance = SessionManagement.getInstance();
export default sessionManagementInstance;
