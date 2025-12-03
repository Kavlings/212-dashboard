import { useState, type ChangeEvent } from "react";

//Define types for component state

interface UploadState {
    selectedFile: File | null;
    isUploading: boolean;
    message: string;
    messageType: 'success' | 'error' | '';
}

function FileUpload() {
    //State with explicit types
    const [selectedFile,setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');


//Event handler with proper typing 
const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]; //optional chaining - check on this later
    setSelectedFile(file || null);
    setMessage(''); //clear previous message

};

//Upload handler - async function 
const handleUpload = async (): Promise<void> => {
    if (!selectedFile) {
        setMessage('Please select a file first!');
        setMessageType('error');
        return;
    }

//Create FormData for file upload 
const formData = new FormData();
formData.append('file', selectedFile);

setIsUploading(true);
setMessage('Uploading...')
setMessageType('');


try {
    //Send file to FastAPI backend
    const response = await fetch ('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
    });

    //Type the response data
    const data: {status?: string; message?: string} = await response.json();

    if (response.ok) {
        setMessage('File Uploaded Successfully!');
        setMessageType('success');
        setSelectedFile(null); //Clear selection
    } else {
        setMessage(`Error: ${data.message || 'Upload failed'}`);
        setMessageType('error');
    }
    } catch (error) {
        //TypeScript knows error might not have .message
        const errorMessage = error instanceof Error
        ? error.message
        : 'An unknown error has occured';
        setMessage(`Error: ${errorMessage}`);
        setMessageType('error');
    } finally {
        setIsUploading(false);
    }
    };

    // Styles object with types

    const containerStyle: React.CSSProperties = {
        padding: '20px',
        maxWidth: '500px',
        margin:'0 auto'
    };

    const buttonStyle: React.CSSProperties = {
        padding: '10px 20px',
        backgroundColor: isUploading ? '#6c757d' : '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
        marginTop: '10px',
    };
    const messageStyle: React.CSSProperties = {
        marginTop: '10px',
        padding: '10px',
        backgroundColor: messageType ==='success' ? '#d4edda' : '#f8d7da',
        color: messageType === 'success' ? '#155724' : '#721c24',
        borderRadius: '5px',
    };

    return (
        <div style={containerStyle}>
            <h2> Upload CSV File </h2>
            {/* {file input with proper typing} */}
            <input type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isUploading}
            style={{marginBottom:'10px', display:'block'}}
             />

             {/* {Conditional rendering} - Typescript knows selectedFile might be null */}
             {
                selectedFile && (
                    <p style={{color:'#666' }}> Selected: {selectedFile.name}</p>
                )}

                {/* {Upload button} */}
                <button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                style={buttonStyle}
                >
                {isUploading ? 'Uploading...' : 'Upload'}
                </button>

                {/* {Success/Error Message} */}
                {message && (
                    <div style={messageStyle}>
                        {message}
                    </div>
                )}
        </div>
    );
}

export default FileUpload;