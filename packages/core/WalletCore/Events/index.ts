import { EventPlugin } from './EventPlugin';
import type { EventBus, EventMap } from './eventTypes';

export {
  BROADCAST_TRANSACTION_EVENT,
  CURRENT_ACCOUNT_CHANGED_EVENT,
  CURRENT_NETWORK_AND_ADDRESS_CHANGED_EVENT,
  CURRENT_NETWORK_CHANGED_EVENT,
  HARDWARE_SIGN_ABORT_EVENT,
  HARDWARE_SIGN_ERROR_EVENT,
  HARDWARE_SIGN_START_EVENT,
  HARDWARE_SIGN_SUCCESS_EVENT,
} from './eventTypes';

export { EventPlugin, type EventBus, type EventMap };
