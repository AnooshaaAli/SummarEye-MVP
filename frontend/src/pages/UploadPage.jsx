import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const validateFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return false;

    // Check extension
    const filename = selectedFile.name.toLowerCase();
    if (!filename.endsWith('.mp4') && !filename.endsWith('.avi') && !filename.endsWith('.mov')) {
      setError('Invalid file type. Please upload .mp4, .avi, or .mov files.');
      setFile(null);
      return false;
    }

    // Check size 500MB
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('File size exceeds the 500MB limit.');
      setFile(null);
      return false;
    }

    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files && e.target.files[0];
    if (validateFile(selectedFile)) {
      setFile(selectedFile);
      setError(null);
    }
    // reset input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
    if (validateFile(droppedFile)) {
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed due to a server error.');
      }

      // Success
      navigate(`/dashboard?video_id=${data.video_id}`);
    } catch (err) {
      // Detect network error (backend unreachable) vs other errors
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Cannot connect to server. Make sure the app is running.');
      } else {
        setError(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-900">
      <div className="w-full max-w-2xl p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 text-center">
        <h1 className="text-4xl font-extrabold text-white mb-6">
          Upload your footage here
        </h1>
        <p className="text-slate-400 mb-8">
          Upload a local video file for AI event analysis.
        </p>

        <div
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700/50 hover:border-indigo-400'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
            <svg className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-indigo-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className="mb-2 text-lg text-slate-300">
              <span className="font-semibold text-white">Drop your CCTV footage here</span>
            </p>
            <p className="text-sm text-slate-500">or click to browse</p>
            <p className="text-xs text-slate-500 mt-2">MP4, AVI, or MOV (max 500MB)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime,video/x-msvideo"
            onChange={handleFileChange}
            ref={fileInputRef}
          />
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {file && !isUploading && !error && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="text-slate-300 text-sm bg-slate-700/50 px-4 py-2 rounded-md border border-slate-600">
              File selected: <span className="font-semibold text-white">{file.name}</span> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </div>

            <button
              onClick={handleUpload}
              className="mt-2 flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-md transition-all duration-200"
            >
              Analyse Video
            </button>
          </div>
        )}

        {isUploading && (
          <div className="mt-6 flex justify-center">
            <button
              disabled={true}
              className="mt-2 flex items-center gap-2 px-8 py-3 bg-indigo-800 text-indigo-300 font-semibold rounded-lg shadow-md cursor-not-allowed transition-all duration-200"
            >
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-indigo-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Uploading...
            </button>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-700/50">
          <Link to="/dashboard" className="text-slate-400 hover:text-indigo-400 transition-colors text-sm font-medium flex items-center justify-center gap-2">
            Go to your Dashboard View
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}
