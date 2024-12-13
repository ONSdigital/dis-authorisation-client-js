import fp from 'lodash/fp.js';
import { defaultConfig } from '../config/config.js';
import {
  checkSessionStatus, renewSession, convertUTCToJSDate,
} from '../utils/utils.js';

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

  async init(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('[LIBRARY] Invalid configuration object');
    }
    this.config = Object.freeze({ ...defaultConfig, ...config });
    console.log('[LIBRARY] Initialising session management with config:', this.config);
    if (this.config.checkSessionOnInit) {
      console.log('[LIBRARY] Checking initial session state');
      const data = await checkSessionStatus();
      const sessionExpiryTime = fp.get('expirationTime')(data);
      if (sessionExpiryTime) {
        console.log('[LIBRARY] Initial session is active, setting timers');
        this.setSessionExpiryTime(convertUTCToJSDate(sessionExpiryTime));
        if (this.config.onSessionValid) {
          this.config.onSessionValid(sessionExpiryTime);
        }
      } else {
        console.log('[LIBRARY] No active session found');
        if (this.config.onSessionInvalid) {
          this.config.onSessionInvalid();
        }
      }
    }
  }

  setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime) {
    console.log('[LIBRARY] Setting session expiry time');
    this.initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime);
  }

  initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime) {
    console.log('[LIBRARY] init config: ', this.config);
    if (!this.config || Object.keys(this.config).length === 0) {
      console.log('[LIBRARY] No config found, initialising with default config');
      this.init(this.config);
    }
    if (sessionExpiryTime) {
      console.log(`[LIBRARY] Session expiry time: ${sessionExpiryTime}`);
      this.startSessionTimer(sessionExpiryTime);
    }
    if (refreshExpiryTime) {
      console.log(`[LIBRARY] Refresh expiry time: ${refreshExpiryTime}`);
      this.startRefreshTimer(refreshExpiryTime);
    }
  }

  startSessionTimer(sessionExpiryTime) {
    this.startExpiryTimer(
      'sessionTimerPassive',
      sessionExpiryTime,
      this.config.timeOffsets.passiveRenewal,
      this.monitorInteraction,
    );
  }

  startRefreshTimer(refreshExpiryTime) {
    this.startExpiryTimer(
      'refreshTimerPassive',
      refreshExpiryTime,
      this.config.timeOffsets.passiveRenewal,
      this.monitorInteraction,
    );
  }

  startExpiryTimer(name, expiryTime, offsetInMilliseconds, callback) {
    console.log(`[LIBRARY] Expiry time for ${name}: ${expiryTime}`);
    if (expiryTime) {
      const now = new Date();
      const timerInterval = expiryTime - now.getTime() - offsetInMilliseconds;
      console.log(`[LIBRARY] Offset for ${name}: ${offsetInMilliseconds}`);
      if (Number.isNaN(timerInterval)) {
        console.error(`[LIBRARY] time interval for ${name} is not a valid date format.`);
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
      console.log("[LIBRARY] an unexpected error has occurred when extending the user's session");
      if (error != null) {
        console.error(error);
        if (this.config.onRenewFailure) {
          this.config.onRenewFailure(error);
        }
      }
    };
    console.log('[LIBRARY] Updating session timer via API 1');
    try {
      const response = await renewSession();
      if (response) {
        const expirationTime = convertUTCToJSDate(fp.get('expirationTime')(response));
        console.log(
          '[LIBRARY] Session renewed successfully, new expiration time:',
          expirationTime,
        );
        this.startSessionTimer(expirationTime);
        if (this.config.onRenewSuccess) {
          this.config.onRenewSuccess(expirationTime);
        }
      } else {
        renewError();
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

    this.timers = {};
  }
}

// Export a single instance of SessionManagement
const sessionManagementInstance = SessionManagement.getInstance();
export default sessionManagementInstance;
