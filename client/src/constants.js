import {
  Boxes,
  CreditCard,
  HandCoins,
  LayoutDashboard,
  PackagePlus,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Truck,
  UserCog,
  Users
} from 'lucide-react';

export const DEFAULT_RATE = 36.62;

export const MENU = [
  {
    label: 'General',
    items: [
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, roles: ['admin', 'vendedor'] },
      { id: 'config', label: 'Configuracion', icon: Settings, roles: ['admin'] },
      { id: 'users', label: 'Usuarios', icon: UserCog, roles: ['admin'] },
      { id: 'paymentTypes', label: 'Tipos de pago', icon: Tags, roles: ['admin'] }
    ]
  },
  {
    label: 'Catalogo',
    items: [
      { id: 'products', label: 'Productos', icon: PackagePlus, roles: ['admin'] },
      { id: 'suppliers', label: 'Proveedores', icon: Truck, roles: ['admin'] },
      { id: 'inventory', label: 'Inventario', icon: Boxes, roles: ['admin'] }
    ]
  },
  {
    label: 'Comercial',
    items: [
      { id: 'pos', label: 'Punto de venta', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
      { id: 'customers', label: 'Clientes', icon: Users, roles: ['admin', 'vendedor'] },
      { id: 'sales', label: 'Historial de ventas', icon: CreditCard, roles: ['admin', 'vendedor'] },
      { id: 'payments', label: 'Abonos', icon: HandCoins, roles: ['admin', 'vendedor'] }
    ]
  },
  {
    label: 'Compras',
    items: [
      { id: 'purchases', label: 'Nueva compra', icon: ShoppingBag, roles: ['admin'] },
      { id: 'purchaseHistory', label: 'Historial de compras', icon: CreditCard, roles: ['admin'] }
    ]
  }
];

export const VIEW_TITLES = {
  dashboard: 'Inicio',
  config: 'Configuracion',
  users: 'Usuarios',
  paymentTypes: 'Tipos de pago',
  products: 'Productos',
  suppliers: 'Proveedores',
  inventory: 'Inventario',
  pos: 'Punto de venta',
  customers: 'Clientes',
  sales: 'Historial de ventas',
  payments: 'Abonos',
  purchases: 'Nueva compra',
  purchaseHistory: 'Historial de compras'
};
