import { useState, type ChangeEvent, type DragEvent } from "react";

function FileUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'loading' | ''>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    setMessage('');
    setMessageType('');
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => setIsDragOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setMessage('');
      setMessageType('');
    } else {
      setMessage('Please drop a CSV file.');
      setMessageType('error');
    }
  };

  const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
      setMessage('Please select a file first.');
      setMessageType('error');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    setIsUploading(true);
    setMessage('Uploading...');
    setMessageType('loading');

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const data: { status?: string; message?: string } = await response.json();

      if (response.ok) {
        setMessage('File uploaded successfully!');
        setMessageType('success');
        setSelectedFile(null);
        onSuccess?.();
      } else {
        setMessage(`Error: ${data.message || 'Upload failed'}`);
        setMessageType('error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An unknown error occurred';
      setMessage(`Error: ${msg}`);
      setMessageType('error');
    } finally {
      setIsUploading(false);
    }
  };

  const messageIcon = { success: '✓', error: '✕', loading: '↑', '': '' }[messageType];

  return (
    <div className="glass-card">
      <p className="glass-card-title">Import Data</p>

      <div
        className={`dropzone${isDragOver ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <div className="dropzone-icon">📊</div>
        <p className="dropzone-label">
          {selectedFile ? selectedFile.name : 'Drop your CSV here'}
        </p>
        <p className="dropzone-sublabel">
          {selectedFile
            ? `${(selectedFile.size / 1024).toFixed(1)} KB · Ready to upload`
            : 'or click to browse · .csv files only'}
        </p>
      </div>

      <button
        className="upload-btn"
        onClick={handleUpload}
        disabled={isUploading || !selectedFile}
      >
        {isUploading ? 'Uploading...' : 'Upload CSV →'}
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

export default FileUpload;
