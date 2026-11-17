/** Stock › Items and costs at a site: this site's own list (supervisors and up). */
import { Navigate } from 'react-router';
import { can, useAuth } from '../lib/auth';
import { useStock } from '../lib/stock';
import { ItemsEditor } from '../components/ItemsEditor';
import { Nav } from '../components/ui';

export default function StockItems() {
  const { user } = useAuth();
  const { siteCode } = useStock();
  if (!user) return null;
  if (!can.editStockItems(user.role)) return <Navigate to="/stock" replace />;
  return (
    <main className="page">
      <Nav back="/stock" backLabel="Stock" title="Items and costs" />
      <div className="body">
        <div className="titleblock"><h1>Items and costs</h1></div>
        <ItemsEditor siteCode={siteCode} />
      </div>
    </main>
  );
}
