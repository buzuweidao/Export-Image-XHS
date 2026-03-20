import cloneDeep from 'lodash/cloneDeep.js';
import set from 'lodash/set.js';

export function updateSettingsAtPath(settings, path, value) {
  const nextSettings = cloneDeep(settings);
  set(nextSettings, path, value);
  return nextSettings;
}
