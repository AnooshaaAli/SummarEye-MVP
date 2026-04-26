import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { trackEvent } from '../utils/tracker';

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
      setError('INVALID_FILE_TYPE: Only .mp4, .avi, .mov accepted.');
      setFile(null);
      return false;
    }

    // Check size 500MB
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError('SIZE_EXCEEDED: File exceeds the 500MB limit.');
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
    trackEvent('video_upload_started', { filename: file.name, size: Math.round(file.size/1024/1024*100)/100 });

    try {
      const token = localStorage.getItem('summareye_token');
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed due to a server error.');
      }

      // Success — redirect to dashboard
      navigate(`/dashboard?video_id=${data.video_id}`);
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('CONNECTION_REFUSED: Backend unreachable. Is the server running?');
        trackEvent('error_occurred', { stage: 'upload', error: 'CONNECTION_REFUSED' });
      } else {
        setError(err.message || 'UNKNOWN_ERROR: An unexpected error occurred.');
        trackEvent('error_occurred', { stage: 'upload', error: err.message });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative">
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg pointer-events-none"></div>

        <div className="w-full max-w-2xl z-10">
          {/* Terminal header */}
          <div className="bg-neon-panel border border-neon-border rounded-t-lg px-4 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-hacker-red"></span>
            <span className="w-2 h-2 rounded-full bg-hacker-yellow"></span>
            <span className="w-2 h-2 rounded-full bg-neon-green"></span>
            <span className="ml-3 text-xs text-neon-dark">upload_module.exe</span>
          </div>

          {/* Main card */}
          <div className="bg-neon-panel border border-neon-border border-t-0 rounded-b-lg p-8">
            <h1 className="text-2xl font-bold text-neon-green text-glow-green mb-2">
              {'>'} Upload Surveillance Feed
            </h1>
            <p className="text-neon-dim text-sm mb-8">
              Drop a video file for AI-powered event detection and threat analysis.
            </p>

            {/* Upload zone */}
            <div
              className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden ${
                isDragging
                  ? 'border-neon-green bg-neon-dark/30 glow-green'
                  : 'border-neon-border bg-black hover:border-neon-dim hover:bg-neon-dark/10'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center justify-center pointer-events-none z-10">
                <svg className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-neon-green' : 'text-neon-dim'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p className="mb-1 text-sm text-neon-green font-bold">
                  Drop your CCTV footage here
                </p>
                <p className="text-xs text-neon-dark">or click to browse files</p>
                <p className="text-[10px] text-neon-dark mt-2 border border-neon-border px-2 py-0.5 rounded">
                  MP4 | AVI | MOV — max 500MB
                </p>
              </div>
            </div>

            <input
              type="file"
              className="hidden"
              accept=".mp4,.avi,.mov,video/mp4,video/avi,video/quicktime,video/x-msvideo"
              onChange={handleFileChange}
              ref={fileInputRef}
            />

            {/* Error message */}
            {error && (
              <div className="mt-6 p-3 bg-black border border-hacker-red rounded text-hacker-red text-xs font-mono glow-red">
                <span className="text-hacker-red font-bold">ERROR:</span> {error}
              </div>
            )}

            {/* File selected */}
            {file && !isUploading && !error && (
              <div className="mt-6 flex flex-col items-center gap-4">
                <div className="text-neon-dim text-xs bg-black px-4 py-2 rounded border border-neon-border w-full text-center">
                  <span className="text-neon-green">FILE:</span> {file.name}
                  <span className="text-neon-dark ml-3">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
                <button
                  onClick={handleUpload}
                  className="px-8 py-3 border-2 border-neon-green text-neon-green font-bold text-sm uppercase tracking-wider rounded hover:bg-neon-green hover:text-black transition-all duration-300 glow-green"
                >
                  {'>'} Analyse Video
                </button>
              </div>
            )}

            {/* Uploading state */}
            {isUploading && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 text-neon-green text-sm">
                  <div className="w-4 h-4 border-2 border-neon-green border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </div>
                <p className="text-[10px] text-neon-dark">streaming bytes to the server</p>
              </div>
            )}

            {/* Footer link */}
            <div className="mt-8 pt-4 border-t border-neon-border text-center">
              <Link to="/dashboard" className="text-neon-dim hover:text-neon-green transition-colors text-xs">
                {'>'} skip to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
