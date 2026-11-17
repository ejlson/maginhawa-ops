/** Head office › Stock › Items and costs: one site's list at a time (each site has its own), with a site picker. */
import { useSearchParams } from 'react-router';
import { SITES } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { ItemsEditor, SitePick } from '../components/ItemsEditor';
import { Nav } from '../components/ui';

export default function HoStockItems() {
  const [params, setParams] = useSearchParams();
  const site = SITES.some((s) => s.code === params.get('site')) ? params.get('site')! : SITES[0]!.code;
  return (
    <HeadOfficeShell>
      <main className="page wide">
        <Nav back="/head-office/stock" backLabel="Stock" title="Items and costs" right={<WhoMenu />} />
        <div className="body">
          <div className="ho-head">
            <div className="titleblock"><span className="eyebrow">Each site keeps its own list</span><h1>Items and costs</h1></div>
            <SitePick value={site} onChange={(code) => setParams({ site: code })} />
          </div>
          <ItemsEditor key={site} siteCode={site} />
        </div>
      </main>
    </HeadOfficeShell>
  );
}
