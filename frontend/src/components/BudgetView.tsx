import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { CreditCard, Wallet, Calendar, ShieldCheck, Zap } from "lucide-react";

const MOCK_CATEGORIES = [
  { name: "Dining", value: 450, color: "#3b82f6" },
  { name: "Groceries", value: 320, color: "#10b981" },
  { name: "Subscriptions", value: 120, color: "#8b5cf6" },
  { name: "Travel", value: 280, color: "#f59e0b" },
  { name: "Other", value: 150, color: "#94a3b8" },
];

const ROADMAP = [
  { icon: <CreditCard size={18} />, title: "T212 Card Sync", desc: "Automatic categorization of your card spending.", status: "In Progress" },
  { icon: <Wallet size={18} />, title: "Custom Budgets", desc: "Set monthly limits per category and track progress.", status: "Planned" },
  { icon: <Calendar size={18} />, title: "Recurring Bills", desc: "Track subscriptions and upcoming payments.", status: "Planned" },
  { icon: <ShieldCheck size={18} />, title: "Fraud Detection", desc: "Smart alerts for unusual spending patterns.", status: "Future" },
];

function BudgetView() {
  return (
    <div className="budget-view">
      <div className="tx-view-header">
        <h1 className="tx-view-title">Budgeting</h1>
        <p className="tx-view-subtitle">Track your spending and manage your financial health.</p>
      </div>

      <div className="budget-layout">
        <div className="budget-main">
          <div className="glass-card chart-card roadmap-preview">
            <div className="preview-overlay">
              <div className="glass-pill preview-pill">
                <Zap size={14} className="green" />
                Coming Soon
              </div>
              <h3>Intelligent Spending Insights</h3>
              <p>We're building a smarter way to track your daily expenses using your Trading 212 card data.</p>
            </div>
            <div className="mock-chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={MOCK_CATEGORIES}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {MOCK_CATEGORIES.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} opacity={0.4} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    itemStyle={{ color: "#94a3b8" }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="roadmap-grid">
            {ROADMAP.map((item, i) => (
              <div key={i} className="glass-card roadmap-card">
                <div className="roadmap-icon">{item.icon}</div>
                <div className="roadmap-content">
                  <div className="roadmap-header">
                    <h4>{item.title}</h4>
                    <span className={`roadmap-status ${item.status.toLowerCase().replace(" ", "-")}`}>
                      {item.status}
                    </span>
                  </div>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BudgetView;
