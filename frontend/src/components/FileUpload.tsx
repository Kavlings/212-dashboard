import { useState, ChangeEvent, FormEvent } from "react";

//Define types for component state

interface UploadState {
    selectedFile: File | null;
    isUploading: boolean
    message: string
    messageType: 'success' | 'error' | '';
}

function FileUpload() {
    //State with explicit types
    const [selectedFile,setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
}

//Event handler with proper typing 
const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]; //optional chaining - check on this later
    setSelectedFile(file || null);
    setMessage(''); //clear previous message

};

//Upload handler - async function 
const handleUpload = async ():