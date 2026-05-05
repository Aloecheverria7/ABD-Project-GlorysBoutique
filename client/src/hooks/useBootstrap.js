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
    lookups: null,
    config: { tasa_cambio_usd: DEFAULT_RATE, updated_at: null },
    loading: true,
    error: ''
  });

  async function load() {
    if (!user) return;
    try {
      setState((current) => ({ ...current, loading: true, error: '' }));

      const [variants, customers, sales, lookups, config] = await Promise.all([
        api.get('/products/variants'),
        api.get('/customers'),
        api.get('/sales'),
        api.get('/catalog/lookups'),
        api.get('/config')
      ]);

      const [products, inventory] = isAdmin
        ? await Promise.all([api.get('/products'), api.get('/inventory')])
        : [[], []];

      setState({ products, variants, customers, inventory, sales, lookups, config, loading: false, error: '' });
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
