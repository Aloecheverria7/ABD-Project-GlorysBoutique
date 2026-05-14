import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { DEFAULT_RATE } from '../constants.js';

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
    lookups: null,
    config: { tasa_cambio_usd: DEFAULT_RATE, updated_at: null },
    loading: true,
    error: ''
  });

  async function load() {
    if (!user) return;
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));

      const [variants, customers, sales, lookups, config, abonos, paymentTypes] = await Promise.all([
        api.get('/products/variants'),
        api.get('/customers'),
        api.get('/sales'),
        api.get('/catalog/lookups'),
        api.get('/config'),
        api.get('/payments'),
        api.get('/payment-types')
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

  function updateConfig(config) {
    setState((current) => ({ ...current, config }));
  }

  return { ...state, reload: load, updateConfig };
}
