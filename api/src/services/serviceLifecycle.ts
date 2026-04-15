/**
 * Service Lifecycle Manager — Central control for background services.
 *
 * Coordinates CRM poller and file watcher start/stop, especially
 * around demo mode transitions.
 */

import { startCrmPoller, stopCrmPoller } from "./crmPoller.js";
import { startFileWatcher, stopFileWatcher } from "./fileWatcher.js";
import { startDemoSimulator, stopDemoSimulator } from "./demoEventSimulator.js";
import { isDemoMode } from "../db/database.js";
import { log } from "../utils/logger.js";

/**
 * Boot background services. Called once from index.ts at startup.
 * Only starts services if NOT in demo mode.
 */
export function bootServices() {
  if (isDemoMode()) {
    log("lifecycle", "Demo mode active — starting demo simulator only");
    startDemoSimulator();
    return;
  }
  startFileWatcher();
  startCrmPoller();
}

/**
 * Pause all background services before entering demo mode.
 * Called from POST /api/demo/activate.
 */
export function pauseServicesForDemo() {
  log("lifecycle", "Pausing background services for demo mode");
  stopCrmPoller();
  stopFileWatcher();
  startDemoSimulator();
}

/**
 * Resume background services after leaving demo mode.
 * Called from POST /api/demo/deactivate.
 */
export function resumeServicesAfterDemo() {
  log("lifecycle", "Resuming background services");
  stopDemoSimulator();
  startFileWatcher();
  startCrmPoller();
}
