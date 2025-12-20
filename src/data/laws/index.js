/**
 * @deprecated This module contains legacy summary data and is no longer used.
 *
 * The app now uses the complete scraped law database via:
 *   import { getAllLawsSync } from '../services/euLawsDatabase'
 *
 * These files contain incomplete/summarized law text and should NOT be used
 * for displaying legal content to users.
 *
 * TODO: Remove this directory once confirmed no external dependencies exist.
 */

import aschg from './aschg.json'
import dguv from './dguv.json'
import arbowet from './arbowet.json'

/** @deprecated Use euLawsDatabase.getAllLawsSync() instead */
export const lawData = {
  AT: aschg,
  DE: dguv,
  NL: arbowet
}

/** @deprecated */
export { aschg, dguv, arbowet }
