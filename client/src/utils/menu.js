/** @file Utilidades del menu lateral. Filtra opciones y valida acceso a vistas segun el rol del usuario. */
import { MENU } from '../constants.js';

/**
 * Construye el menu visible para un rol, conservando solo los items autorizados
 * y descartando los grupos que quedan sin items.
 *
 * @param {string} rol - Rol del usuario (por ejemplo 'admin' o 'vendedor').
 * @returns {Array<{label: string, items: Array<Object>}>} Grupos de menu filtrados por rol.
 */
export function visibleMenu(rol) {
  return MENU
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(rol))
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Indica si un rol tiene acceso a una vista determinada buscando el item en el menu.
 *
 * @param {string} viewId - Identificador de la vista a comprobar.
 * @param {string} rol - Rol del usuario.
 * @returns {boolean} true si el rol puede acceder a la vista; false en caso contrario.
 */
export function canAccess(viewId, rol) {
  for (const group of MENU) {
    for (const item of group.items) {
      if (item.id === viewId) return item.roles.includes(rol);
    }
  }
  return false;
}
