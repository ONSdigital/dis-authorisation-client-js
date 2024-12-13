import fp from 'lodash/fp.js';
import { apiConfig, defaultConfig } from '../config/config.js';

class SessionManagement {
  static instance;

  constructor() {
    if (SessionManagement.instance) {
      return SessionManagement.instance;
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

  async init(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('[LIBRARY] Invalid configuration object');
    }
    this.config = Object.freeze({ ...defaultConfig, ...config });
    console.log('[LIBRARY] Initialising session management with config:', this.config);
    if (this.config.checkSessionOnInit) {
      console.log('[LIBRARY] Checking initial session state');
      const data = await this.checkSessionStatus();
      const sessionExpiryTime = fp.get('expirationTime')(data);
      if (sessionExpiryTime) {
        console.log('[LIBRARY] Initial session is active, setting timers');
        this.setSessionExpiryTime(this.convertUTCToJSDate(sessionExpiryTime));
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

  convertUTCToJSDate(expiryTime) {
    if (expiryTime) {
      const expireTimeInUTCString = expiryTime.replace(' +0000 UTC', 'Z');
      console.log('[LIBRARY] UTC to JS date: ', expireTimeInUTCString);
      return new Date(expireTimeInUTCString);
    }
    return null;
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
      const response = await this.renewSession();
      if (response) {
        const expirationTime = this.convertUTCToJSDate(fp.get('expirationTime')(response));
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

  isSessionExpired(sessionExpiryTime) {
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

  async renewSession(body) {
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

  async checkSessionStatus() {
    console.log('[LIBRARY] Checking initial session status');
    const response = await fetch(apiConfig.CHECK_SESSION, { method: 'GET' });

    if (response.ok) {
      const data = await response.json();
      console.log('[LIBRARY] Initial session status:', data);
      return data;
    }
    throw new Error('Failed to check session status');
  };

  removeTimers() {
    this.removeInteractionMonitoring();

    Object.values(this.timers).forEach((timer) => {
      clearTimeout(timer);
    });

    this.timers = {};
  }

  createDefaultExpireTimes(hours) {
    console.log('[LIBRARY] Creating default expire times for', hours, 'hours');
    const now = new Date();
    const expiry = now.setHours(now.getHours() + hours);
    return {
      session_expiry_time: new Date(expiry),
      refresh_expiry_time: new Date(expiry),
    };
  }
}

// Export a single instance of SessionManagement
const sessionManagementInstance = new SessionManagement();
export default sessionManagementInstance;