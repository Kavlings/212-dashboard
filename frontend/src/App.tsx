import { useState, useEffect } from "react";
import FileUpload from "./components/FileUpload";
import ApiConnect from "./components/ApiConnect";
import Dashboard from "./components/Dashboard";
import { Database, Zap, TrendingUp } from "lucide-react";
import "./App.css";

type AppView = "upload" | "dashboard";

function App() {
  const [view, setView] = useState<AppView>("upload");

  useEffect(() => {
    document.title = "212 Dashboard | Your portfolio, clearly.";
  }, []);

  return (
    <div className="app">
      {view === "upload" && (
        <div className="upload-page">
          <header className="navbar">
            <span className="navbar-brand">
              <span className="navbar-brand-dot" />
              212 Dashboard
            </span>
          </header>
          <main className="hero">
            <div className="hero-text">
              <h1 className="hero-title hero-title-gradient">Your portfolio,<br />clearly.</h1>
              <p className="hero-subtitle">Import via CSV or connect directly with the Trading 212 API for real-time portfolio analysis.</p>
            </div>
            <div className="stats-row">
              <div className="stat-pill">
                <Database size={14} />
                CSV & API Import
              </div>
              <div className="stat-pill">
                <Zap size={14} />
                Real-time Analysis
              </div>
              <div className="stat-pill">
                <TrendingUp size={14} />
                P&L Tracking
              </div>
            </div>
            <div className="import-grid">
              <FileUpload onSuccess={() => setView("dashboard")} />
              <ApiConnect onSuccess={() => setView("dashboard")} />
            </div>
          </main>
        </div>
      )}
      {view === "dashboard" && (
        <Dashboard onImport={() => setView("upload")} />
      )}
    </div>
  );
}

export default App;


