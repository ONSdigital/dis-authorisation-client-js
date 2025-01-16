import SessionManagement from './lib/session-management.js';
import {
  createDefaultExpiryTimes, checkSessionStatus, renewSession, isSessionExpired,
} from './utils/utils.js';

export {
  createDefaultExpiryTimes, checkSessionStatus, renewSession, isSessionExpired,
};
export default SessionManagement;
