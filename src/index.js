import SessionManagement from './lib/session-management.js';
import {
  createDefaultExpiryTimes, checkSessionStatus, renewSession, isSessionExpired, convertUTCToJSDate,
} from './utils/utils.js';

export {
  createDefaultExpiryTimes, checkSessionStatus, renewSession, isSessionExpired, convertUTCToJSDate,
};
export default SessionManagement;
