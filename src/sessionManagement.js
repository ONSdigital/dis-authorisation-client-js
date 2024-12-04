import fp from 'lodash/fp';

export default class SessionManagement {
  static config = {
    timeOffsets: {
      passiveRenewal: 2000,
      invasiveRenewal: 3000,
    },
  };

  static timers = {};

  static eventsToMonitor = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

  static init(config) {
    this.config = config;
  }

  static setSessionExpiryTime(sessionExpiryTime, refreshExpiryTime) {
    console.log('[LIBRARY] Setting session expiry time');
    this.initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime);
  }

  static initialiseSessionExpiryTimers(sessionExpiryTime, refreshExpiryTime) {
    if (sessionExpiryTime) {
      console.log(`[LIBRARY] Session expiry time: ${sessionExpiryTime}`);
      this.startSessionTimer(sessionExpiryTime);
    }
    if (refreshExpiryTime) {
      console.log(`[LIBRARY] Refresh expiry time: ${refreshExpiryTime}`);
      this.startRefreshTimer(refreshExpiryTime);
    }
  }

  static startSessionTimer(sessionExpiryTime) {
    this.startExpiryTimer(
      'sessionTimerPassive',
      sessionExpiryTime,
      this.config.timeOffsets.passiveRenewal,
      this.monitorInteraction,
    );
  }

  static startRefreshTimer(refreshExpiryTime) {
    this.startExpiryTimer(
      'refreshTimerPassive',
      refreshExpiryTime,
      this.config.timeOffsets.passiveRenewal,
      this.monitorInteraction,
    );
  }

  static convertUTCToJSDate(expiryTime) {
    if (expiryTime) {
      const expireTimeInUTCString = expiryTime.replace(' +0000 UTC', 'Z');
      return new Date(expireTimeInUTCString);
    }
    return null;
  }

  static startExpiryTimer(name, expiryTime, offsetInMilliseconds, callback) {
    console.log(`[LIBRARY] Setting timer for ${name}`);
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

  static monitorInteraction = () => {
    console.log('[LIBRARY] Monitoring user interaction');
    console.log('[LIBRARY] Event listeners added: ', this.eventsToMonitor);
    this.eventsToMonitor.forEach((name) => {
      document.addEventListener(name, this.refreshSession);
    });
  };

  static removeInteractionMonitoring = () => {
    console.log('[LIBRARY] Removing interaction monitoring');
    this.eventsToMonitor.forEach((name) => {
      document.removeEventListener(name, this.refreshSession);
    });
  };

  static refreshSession = () => {
    console.log('[LIBRARY] Refreshing session');
    this.removeInteractionMonitoring();
    const renewError = (error) => {
      console.error("[LIBRARY] an unexpected error has occurred when extending the user's session");
      if (error != null) {
        console.error(error);
      }
    };
    console.log('[LIBRARY] Updating session timer via API 1');
    this.renewSession()
      .then((response) => {
        if (response) {
          console.log('[LIBRARY] Session renewed successfully, response data:', response);
          const expirationTime = this.convertUTCToJSDate(fp.get('expirationTime')(response.data));
          console.log(
            '[LIBRARY] Session renewed successfully, new expiration time:',
            expirationTime,
          );
          this.startSessionTimer(expirationTime);
        } else {
          renewError();
        }
      })
      .catch((error) => {
        renewError(error);
      });
  };

  static isSessionExpired(sessionExpiryTime) {
    console.log('[IS SESSION EXPIRED] expiry date: ', sessionExpiryTime);
    if (sessionExpiryTime == null) {
      return true;
    }
    const now = new Date();
    const nowUTCInMS = now.getTime() + now.getTimezoneOffset() * 60000;
    const nowInUTC = new Date(nowUTCInMS);

    // Get the time difference between now and the expiry time minus the timer offset
    const timerInterval = new Date(sessionExpiryTime) - nowInUTC;

    const diffInSeconds = Math.round(timerInterval / 1000);
    if (Number.isNaN(diffInSeconds)) {
      throw new Error('encounted an error checking time interval: diffInSeconds is NaN');
    }
    console.log('[IS SESSION EXPIRED] diff: ', diffInSeconds);
    if (diffInSeconds <= 0) {
      return true;
    }
    return false;
  }

  static async renewSession(body) {
    console.log('[LIBRARY] Starting session renewal process');

    const response = await fetch('api/tokens/self', {
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
}
