import { useState, useEffect, type ChangeEvent } from "react";



function ApiConnect({ onSuccess }: { onSuccess?: () => void }) {
  const [apiKey, setApiKey] = useState<string>("");
  const [apiSecret, setApiSecret] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "loading" | "">("");

  useEffect(() => {
    const stored = sessionStorage.getItem("t212_api_key");
    if (stored) setApiKey(stored);
    const storedSecret = sessionStorage.getItem("t212_api_secret");
    if (storedSecret) setApiSecret(storedSecret);
  }, []);

  const handleKeyChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setApiKey(val);
    sessionStorage.setItem("t212_api_key", val);
  };

  const handleSecretChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    setApiSecret(val);
    sessionStorage.setItem("t212_api_secret", val);
  };



  const handleSync = async (): Promise<void> => {
    if (!apiKey.trim()) {
      setMessage("Please enter your API key.");
      setMessageType("error");
      return;
    }

    setIsSyncing(true);
    setMessage("Syncing with Trading 212...");
    setMessageType("loading");

    try {
      const response = await fetch("http://localhost:8000/api-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          api_key: apiKey.trim(), 
          api_secret: apiSecret.trim(), 
          account_type: "live", 
          product_type: "invest" 
        }),
      });
      const data: { inserted?: number; skipped?: number; detail?: string } = await response.json();

      if (response.ok) {
        setMessage(`Synced ${data.inserted} new transactions (${data.skipped} already existed)`);
        setMessageType("success");
        onSuccess?.();
      } else {
        setMessage(`Error: ${data.detail || "Sync failed"}`);
        setMessageType("error");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "An unknown error occurred";
      setMessage(`Error: ${msg}`);
      setMessageType("error");
    } finally {
      setIsSyncing(false);
    }
  };

  const messageIcon = { success: "✓", error: "✕", loading: "↑", "": "" }[messageType];

  return (
    <div className="glass-card">
      <p className="glass-card-title">Connect API</p>

      <div className="api-key-area">
        <p className="dropzone-label">Trading 212 API Key</p>
        <p className="dropzone-sublabel">Settings → API in the T212 app · Invest/ISA accounts only</p>

        <div className="api-key-input-row">
          <input
            type={showKey ? "text" : "password"}
            className="api-key-input"
            placeholder="API key"
            value={apiKey}
            onChange={handleKeyChange}
            disabled={isSyncing}
          />
          <button
            className="api-key-toggle"
            type="button"
            onClick={() => setShowKey((s) => !s)}
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? "🙈" : "👁"}
          </button>
        </div>
        <div className="api-key-input-row">
          <input
            type={showKey ? "text" : "password"}
            className="api-key-input"
            placeholder="Secret key"
            value={apiSecret}
            onChange={handleSecretChange}
            disabled={isSyncing}
          />
        </div>
      </div>

      <button
        className="upload-btn"
        onClick={handleSync}
        disabled={isSyncing || !apiKey.trim()}
      >
        {isSyncing ? "Syncing..." : "Sync Portfolio →"}
      </button>

      {message && (
        <div className={`message-banner ${messageType}`}>
          <span>{messageIcon}</span>
          {message}
        </div>
      )}
    </div>
  );
}

export default ApiConnect;
