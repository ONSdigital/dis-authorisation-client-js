import fp from 'lodash/fp.js';
import { defaultConfig } from '../config/config.js';
import {
  checkSessionStatus, renewSession, validateExpiryTime
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

  init(config = {}) {
    if (typeof config !== 'object') {
      throw new Error('[LIBRARY] Invalid configuration object');
    }
    this.config = Object.freeze({ ...defaultConfig, ...config });
    console.debug('[LIBRARY] Initialising session management with config:', this.config);
  }

  setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime) {
    console.debug('[LIBRARY] Setting session expiry time');
    this.initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime);
  }

  async initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime) {
    console.debug('[LIBRARY] init config: ', this.config);
    if (!this.config || Object.keys(this.config).length === 0) {
      console.debug('[LIBRARY] No config found, initialising with default config');
      this.init(this.config);
    }

    try {
      console.debug('[LIBRARY] Checking initial session state');
      const { checkedSessionExpiryTime, checkedRefreshExpiryTime } = await checkSessionStatus();

      const finalSessionExpiryTime = checkedSessionExpiryTime || validateExpiryTime(sessionExpiryTime);
      const finalRefreshExpiryTime = checkedRefreshExpiryTime || validateExpiryTime(refreshExpiryTime);

      console.debug('[LIBRARY] sessionExpiryTime: ', finalSessionExpiryTime);
      console.debug('[LIBRARY] refreshExpiryTime: ', finalRefreshExpiryTime);

      if (finalSessionExpiryTime) {
        console.debug(`[LIBRARY] Session expiry time: ${finalSessionExpiryTime}`);
        this.startSessionTimer(finalSessionExpiryTime);
      }
      if (finalRefreshExpiryTime) {
        console.debug(`[LIBRARY] Refresh expiry time: ${finalRefreshExpiryTime}`);
        this.startRefreshTimer(finalRefreshExpiryTime);
      }
      if (!finalSessionExpiryTime && !finalRefreshExpiryTime) {
        console.error('[LIBRARY] Failed to initialise session expiry timers: No expiry times provided');
        this.handleSessionValidity(false);
      } else {
        this.handleSessionValidity(true, finalSessionExpiryTime, finalRefreshExpiryTime);
      }
    } catch (error) {
      console.error('[LIBRARY] Failed to initialise session expiry timers:', error);
      this.handleSessionValidity(false);
    }
  }

  handleSessionValidity(isValid, sessionExpiryTime, refreshExpiryTime) {
    const { onSessionValid, onSessionInvalid } = this.config;
  
    if (isValid) {
      if (onSessionValid) {
        onSessionValid(sessionExpiryTime, refreshExpiryTime);
      } else {
        console.debug('[LIBRARY] No onSessionValid callback provided.');
      }
    } else {
      if (onSessionInvalid) {
        onSessionInvalid();
      } else {
        console.debug('[LIBRARY] No onSessionInvalid callback provided.');
      }
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
    console.debug(`[LIBRARY] Expiry time for ${name}: ${expiryTime}`);
    if (expiryTime) {
      const now = new Date();
      const timerInterval = new Date(expiryTime) - now.getTime() - this.config.timeOffsets.passiveRenewal;
      console.debug(`[LIBRARY] Offset for ${name}: ${this.config.timeOffsets.passiveRenewal}`);
      if (Number.isNaN(timerInterval)) {
        console.error(`[LIBRARY] time interval for ${name} is not a valid date format: ${timerInterval}`);
        return;
      }
      if (this.timers[name] != null) {
        clearTimeout(this.timers[name]);
      }
      console.debug(`[LIBRARY] Interval for ${name} set to ${timerInterval}`);
      this.timers[name] = setTimeout(callback, timerInterval);
    }
  }

  monitorInteraction() {
    console.debug('[LIBRARY] Event listeners added: ', this.eventsToMonitor);
    this.eventsToMonitor.forEach((name) => {
      document.addEventListener(name, this.refreshSession);
    });
  }

  removeInteractionMonitoring() {
    console.debug('[LIBRARY] Removing interaction monitoring');
    this.eventsToMonitor.forEach((name) => {
      document.removeEventListener(name, this.refreshSession);
    });
  }

  async refreshSession() {
    console.debug('[LIBRARY] Refreshing session');
    this.removeInteractionMonitoring();
    const renewError = (error) => {
      console.error("[LIBRARY] an unexpected error has occurred when extending the user's session: ", error);
      if (error != null) {
        if (this.config.onRenewFailure) {
          this.config.onRenewFailure(error);
        }
      }
    };
    try {
      const response = await renewSession();
      if (response) {
        let expirationTime = fp.get('expirationTime')(response);
        console.debug(
          '[LIBRARY] Session renewed successfully, new expiration time:',
          expirationTime,
        );
        expirationTime = validateExpiryTime(expirationTime);
        console.debug(
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
