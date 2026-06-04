/** @file Hook de carga inicial de datos del panel. Reune en paralelo la informacion del negocio tras iniciar sesion. */
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DEFAULT_RATE } from '../constants.js';

/**
 * Hook que carga en paralelo todos los datos del panel tras iniciar sesion.
 * Los datos de solo-admin (productos, inventario, proveedores, compras y usuarios)
 * se cargan unicamente si el usuario tiene rol admin. Recarga automaticamente
 * cuando cambia el id del usuario.
 *
 * @param {{ id: number, rol: string }} user - Usuario autenticado.
 * @returns {Object} Estado con los datos cargados (products, variants, customers,
 *   inventory, sales, suppliers, purchases, users, abonos, paymentTypes, caja,
 *   lookups, config), las banderas loading y error, mas reload() para recargar y
 *   updateConfig() para actualizar la configuracion en memoria.
 */
export function useBootstrap(user) {
  const isAdmin = user?.rol === 'admin';
  const [state, setState] = useState({
    products: [],
    variants: [],
    customers: [],
    inventory: [],
    sales: [],
    suppliers: [],
    purchases: [],
    users: [],
    abonos: [],
    paymentTypes: [],
    caja: { base: 0, saldo: 0, movimientos: [] },
    lookups: null,
    config: { tasa_cambio_usd: DEFAULT_RATE, caja_base: 0, updated_at: null },
    loading: true,
    error: ''
  });

  /**
   * Carga los datos del negocio desde la API y actualiza el estado.
   * Realiza las peticiones comunes en paralelo y, si el usuario es admin, agrega
   * las peticiones de solo-admin. Maneja banderas de carga y error.
   *
   * @returns {Promise<void>}
   */
  async function load() {
    if (!user) return;
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));

      const [variants, customers, sales, lookups, config, abonos, paymentTypes, caja] = await Promise.all([
        api.get('/products/variants'),
        api.get('/customers'),
        api.get('/sales'),
        api.get('/catalog/lookups'),
        api.get('/config'),
        api.get('/payments'),
        api.get('/payment-types'),
        api.get('/caja')
      ]);

      const [products, inventory, suppliers, purchases, users] = isAdmin
        ? await Promise.all([
            api.get('/products'),
            api.get('/inventory'),
            api.get('/suppliers'),
            api.get('/purchases'),
            api.get('/users')
          ])
        : [[], [], [], [], []];

      setState({
        products,
        variants,
        customers,
        inventory,
        sales,
        suppliers,
        purchases,
        users,
        abonos,
        paymentTypes,
        caja,
        lookups,
        config,
        loading: false,
        error: ''
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  /**
   * Actualiza en memoria la configuracion del negocio sin recargar el resto de datos.
   *
   * @param {Object} config - Nueva configuracion a fijar en el estado.
   */
  function updateConfig(config) {
    setState((current) => ({ ...current, config }));
  }

  return { ...state, reload: load, updateConfig };
}
