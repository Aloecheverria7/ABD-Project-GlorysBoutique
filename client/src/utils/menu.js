import { MENU } from '../constants.js';

export function visibleMenu(rol) {
  return MENU
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(rol))
    }))
    .filter((group) => group.items.length > 0);
}

export function canAccess(viewId, rol) {
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.id === viewId) return item.roles.includes(rol);
    }
  }
  return false;
}
