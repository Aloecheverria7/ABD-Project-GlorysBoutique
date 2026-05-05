import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  PackagePlus,
  Settings,
  ShoppingCart,
  Users
} from 'lucide-react';

export const DEFAULT_RATE = 36.62;

export const MENU = [
  {
    label: 'General',
    items: [
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'vendedor'] },
      { id: 'config', label: 'Configuracion', icon: Settings, roles: ['admin'] }
    ]
  },
  {
    label: 'Catalogo',
    items: [
      { id: 'products', label: 'Productos', icon: PackagePlus, roles: ['admin'] },
      { id: 'inventory', label: 'Inventario', icon: Boxes, roles: ['admin'] }
    ]
  },
  {
    label: 'Comercial',
    items: [
      { id: 'pos', label: 'Punto de venta', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
      { id: 'customers', label: 'Clientes', icon: Users, roles: ['admin', 'vendedor'] },
      { id: 'sales', label: 'Historial de ventas', icon: CreditCard, roles: ['admin', 'vendedor'] }
    ]
  }
];

export const VIEW_TITLES = {
  dashboard: 'Inicio',
  config: 'Configuracion',
  products: 'Productos',
  inventory: 'Inventario',
  pos: 'Punto de venta',
  customers: 'Clientes',
  sales: 'Historial de ventas'
};
