import FileUpload from './components/FileUpload';
import './App.css';

function App(): React.JSX.Element {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="navbar-brand-dot" />
          212 Dashboard
        </div>
        <div className="navbar-links">
          <a href="#">Portfolio</a>
          <a href="#">Analytics</a>
          <a href="#">History</a>
        </div>
        <button className="navbar-cta">Get Started →</button>
      </nav>

      <section className="hero">
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          Trading 212 Portfolio Tracker
        </div>
        <h1 className="hero-title">
          <em>Own</em> your portfolio
        </h1>
        <p className="hero-subtitle">
          Upload your Trading 212 CSV exports and get a complete view of your
          investments, dividends, and performance — all in one place.
        </p>
      </section>

      <div className="stats-row">
        <div className="stat-item">
          <div className="stat-value">CSV</div>
          <div className="stat-label">Import</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">Real-time</div>
          <div className="stat-label">Analysis</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">P&amp;L</div>
          <div className="stat-label">Tracking</div>
        </div>
      </div>

      <div className="upload-section">
        <FileUpload />
      </div>
    </div>
  );
}

export default App;
