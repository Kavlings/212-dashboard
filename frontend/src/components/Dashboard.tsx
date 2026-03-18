import {useState} from "react";
import Sidebar, { type View } from "./Sidebar";
import PortfolioView from "./PortfolioView";
import TransactionsView from "./TransactionsView";
import SpendingView from "./SpendingView";


interface DashboardProps {
  onImport: () => void;
}


function Dashboard({onImport}: DashboardProps) {
  const [view, setView] = useState<View>("overview");


return (
  <div className="dash-layout">
    <Sidebar activeView={view} onNavigate={setView} onImport={onImport} />
    <main className="dash-main">
      {view === "overview" && <PortfolioView />}
      {view === "transactions" && <TransactionsView />}
      {view === "cashflow" && <SpendingView />}
    </main>
  </div>
)

}

export default Dashboard;