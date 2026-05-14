import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Logo } from './components/Logo.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Dashboard } from './views/Dashboard.jsx';
import { Configuration } from './views/Configuration.jsx';
import { Products } from './views/Products.jsx';
import { Customers } from './views/Customers.jsx';
import { Inventory } from './views/Inventory.jsx';
import { POS } from './views/POS.jsx';
import { Sales } from './views/Sales.jsx';
import { Suppliers } from './views/Suppliers.jsx';
import { Purchases } from './views/Purchases.jsx';
import { PurchaseHistory } from './views/PurchaseHistory.jsx';
import { UsersView } from './views/Users.jsx';
import { PaymentTypes } from './views/PaymentTypes.jsx';
import { Payments } from './views/Payments.jsx';
import { useBootstrap } from './hooks/useBootstrap.js';
import { canAccess, visibleMenu } from './utils/menu.js';
import { VIEW_TITLES } from './constants.js';

export function Workspace({ user, onLogout }) {
  const data = useBootstrap(user);
  const allowedDefault = canAccess('dashboard', user.rol) ? 'dashboard' : visibleMenu(user.rol)[0]?.items[0]?.id;
  const [activeView, setActiveView] = useState(allowedDefault);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!canAccess(activeView, user.rol)) {
      setActiveView(allowedDefault);
    }
  }, [user.rol]);

  function renderView() {
    if (!canAccess(activeView, user.rol)) {
      return <div className="alert">No tienes acceso a este modulo.</div>;
    }
    switch (activeView) {
      case 'products':
        return <Products products={data.products} suppliers={data.suppliers} lookups={data.lookups} reload={data.reload} />;
      case 'suppliers':
        return <Suppliers suppliers={data.suppliers} products={data.products} reload={data.reload} />;
      case 'customers':
        return <Customers customers={data.customers} lookups={data.lookups} reload={data.reload} />;
      case 'inventory':
        return <Inventory products={data.products} variants={data.variants} inventory={data.inventory} reload={data.reload} />;
      case 'pos':
        return <POS variants={data.variants} customers={data.customers} lookups={data.lookups} config={data.config} user={user} reload={data.reload} />;
      case 'sales':
        return <Sales sales={data.sales} user={user} />;
      case 'purchases':
        return <Purchases variants={data.variants} suppliers={data.suppliers} config={data.config} reload={data.reload} />;
      case 'purchaseHistory':
        return <PurchaseHistory purchases={data.purchases} />;
      case 'users':
        return <UsersView users={data.users} lookups={data.lookups} currentUser={user} reload={data.reload} />;
      case 'paymentTypes':
        return <PaymentTypes paymentTypes={data.paymentTypes} reload={data.reload} />;
      case 'payments':
        return <Payments abonos={data.abonos} customers={data.customers} paymentTypes={data.paymentTypes} reload={data.reload} />;
      case 'config':
        return <Configuration config={data.config} onUpdated={data.updateConfig} />;
      case 'dashboard':
      default:
        return <Dashboard data={data} user={user} />;
    }
  }

  return (
    <div className="layout">
      <Sidebar
        activeView={activeView}
        onSelect={setActiveView}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        onLogout={onLogout}
      />
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <span />
              <span />
              <span />
            </button>
            <Logo size={36} variant="dark" />
            <div>
              <p>Glory's Boutique</p>
              <h1>{VIEW_TITLES[activeView] || 'Panel'}</h1>
            </div>
          </div>
          <button type="button" className="refresh-button" onClick={data.reload}>
            <RefreshCw size={16} />
            <span>Refrescar</span>
          </button>
        </header>

        {data.error && <div className="alert">{data.error}</div>}
        {data.loading && <div className="loading">Cargando datos...</div>}

        <div className="view">{renderView()}</div>
      </main>
    </div>
  );
}
