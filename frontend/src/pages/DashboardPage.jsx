import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const urlVideoId = searchParams.get('video_id');

  const [videos, setVideos] = useState([]);
  const [selectedVideoId, setSelectedVideoId] = useState(urlVideoId || null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [events, setEvents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalEvent, setModalEvent] = useState(null);
  
  // Format helpers
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const formatMinutes = (seconds) => {
    return Math.floor(seconds / 60);
  };

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // API Fetches
  const fetchVideos = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/videos');
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVideoDetails = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/videos/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const fetchEventsAndAlerts = async (id) => {
    try {
      const [eventsRes, alertsRes] = await Promise.all([
        fetch(`http://localhost:8000/api/videos/${id}/events`),
        fetch(`http://localhost:8000/api/videos/${id}/alerts`)
      ]);
      if (eventsRes.ok && alertsRes.ok) {
        const eventsData = await eventsRes.json();
        const alertsData = await alertsRes.json();
        setEvents(eventsData);
        setAlerts(alertsData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startAnalysis = async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/analyse/${id}`, { method: 'POST' });
      if (res.ok) {
        showToast('Analysis started', 'success');
        const updatedVideo = await fetchVideoDetails(id);
        if (updatedVideo) {
          setSelectedVideo(updatedVideo);
          fetchVideos(); // Refresh sidebar
        }
      } else {
        showToast('Failed to start analysis', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error starting analysis', 'error');
    }
  };

  // Initial Load
  useEffect(() => {
    const init = async () => {
      await fetchVideos();
      if (urlVideoId) {
        const detail = await fetchVideoDetails(urlVideoId);
        if (detail) {
          setSelectedVideo(detail);
          if (detail.status === 'done') {
            await fetchEventsAndAlerts(urlVideoId);
          }
        }
      }
      setIsInitialLoad(false);
    };
    init();
  }, [urlVideoId]);

  // Sidebar selection
  const handleSelectVideo = async (id) => {
    setSelectedVideoId(id);
    const detail = await fetchVideoDetails(id);
    setSelectedVideo(detail);
    if (detail && detail.status === 'done') {
      await fetchEventsAndAlerts(id);
    } else {
      setEvents([]);
      setAlerts([]);
    }
  };

  // Polling logic
  useEffect(() => {
    let interval;
    if (selectedVideo && selectedVideo.status === 'processing') {
      interval = setInterval(async () => {
        const vidId = selectedVideo.video_id || selectedVideo.id;
        const updated = await fetchVideoDetails(vidId);
        if (updated) {
          setVideos(prev => prev.map(v => (v.video_id || v.id) === (updated.video_id || updated.id) ? updated : v));
          
          if (updated.status !== 'processing') {
            setSelectedVideo(updated);
            
            if (updated.status === 'done') {
              await fetchEventsAndAlerts(vidId);
              const totalAlerts = updated.event_count || 0; // Check real alerts count later
              showToast(`✅ Analysis complete — events detected!`, 'success');
            } else if (updated.status === 'error') {
              showToast('Analysis failed', 'error');
            }
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [selectedVideo]);

  // UI Components
  const EventCard = ({ event, isAlert }) => {
    let confidenceClass = 'bg-red-900/50 text-red-400 border-red-500/50';
    let confText = `${Math.round(event.confidence * 100)}% — verify manually`;
    if (event.confidence >= 0.8) {
      confidenceClass = 'bg-green-900/50 text-green-400 border-green-500/50';
      confText = `${Math.round(event.confidence * 100)}% confident`;
    } else if (event.confidence >= 0.5) {
      confidenceClass = 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50';
      confText = `${Math.round(event.confidence * 100)}% confident`;
    }

    return (
      <div className={`p-4 rounded-lg bg-slate-800 border ${isAlert ? 'border-l-4 border-l-red-500 border-slate-700 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-700'} flex gap-4 mt-4`}>
        <div className="flex-shrink-0 w-24 h-20 bg-slate-900 rounded overflow-hidden relative">
          <img 
             src={`http://localhost:8000/api/thumbnails/${event.id}`} 
             alt="Event Thumbnail" 
             className="w-full h-full object-cover"
             onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              {isAlert ? (
                <div className="text-red-500 font-bold text-sm mb-1 animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span> LOITERING ALERT
                </div>
              ) : (
                <div className="text-slate-400 text-sm mb-1 font-semibold uppercase tracking-wider">
                  Person Detected
                </div>
              )}
              <div className="text-white">
                Timestamp: <span className="font-semibold text-slate-200">at {formatTime(event.start_time)}</span>
              </div>
              {isAlert && (
                <div className="text-red-400 text-sm mt-1">
                  Duration: {formatMinutes(event.duration_s)} minutes
                </div>
              )}
            </div>
            
            <div className={`px-2 py-1 text-xs border rounded-md ${confidenceClass}`} title={confText}>
              {confText}
            </div>
          </div>
          <div className="mt-2 text-right">
            <button 
              onClick={() => setModalEvent(event)}
              className="px-4 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded text-sm transition-colors font-medium border border-indigo-500/30"
            >
              View Clip
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'done': return <span className="bg-green-900/50 text-green-400 border border-green-700/50 px-2 py-0.5 rounded text-xs ml-auto">Done</span>;
      case 'processing': return <span className="bg-indigo-900/50 text-indigo-400 border border-indigo-700/50 px-2 py-0.5 rounded text-xs ml-auto flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>Processing</span>;
      case 'error': return <span className="bg-red-900/50 text-red-400 border border-red-700/50 px-2 py-0.5 rounded text-xs ml-auto">Error</span>;
      case 'pending': return <span className="bg-slate-700 text-slate-300 border border-slate-600 px-2 py-0.5 rounded text-xs ml-auto">Pending</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-300 font-sans">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-xl border z-50 animate-in slide-in-from-top flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-900 border-green-600 text-green-100' : 'bg-red-900 border-red-600 text-red-100'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
          </svg>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            SummarEye AI
          </h1>
        </div>
        <nav>
          <Link to="/" className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700 transition">
            Upload New Video
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]">
        {/* Left Sidebar */}
        <aside className="w-72 bg-slate-800/50 border-r border-slate-800 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 sticky top-0">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Footage Library</h2>
          </div>
          
          {isInitialLoad ? (
             <div className="p-4 space-y-4">
               {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-700/50 animate-pulse rounded"></div>)}
             </div>
          ) : (
             <div className="flex flex-col p-2 gap-1">
               {videos.length === 0 ? (
                 <div className="p-4 text-sm text-slate-500 text-center">No footage uploaded yet.</div>
               ) : (
                 videos.map(v => {
                   const vidId = v.video_id || v.id;
                   return (
                   <button 
                     key={vidId} 
                     onClick={() => handleSelectVideo(vidId)}
                     className={`flex flex-col text-left p-3 rounded-lg transition-colors ${selectedVideoId === vidId ? 'bg-indigo-900/40 border border-indigo-700/50' : 'hover:bg-slate-700/50 border border-transparent'}`}
                   >
                     <div className="flex items-start w-full gap-2">
                       <span className="font-medium text-sm text-slate-200 truncate flex-1" title={v.filename}>{v.filename}</span>
                       {getStatusBadge(v.status)}
                     </div>
                     <span className="text-xs text-slate-500 mt-1">{new Date(v.upload_time).toLocaleDateString()}</span>
                   </button>
                   );
                 })
               )}
             </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#0a0f1a]">
          {!selectedVideoId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-16 h-16 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <h2 className="text-2xl font-bold text-slate-400 mb-2">No footage selected</h2>
              <p className="text-slate-500 max-w-md">
                Select a video from the sidebar library to view its analysis, or upload a new video to get started.
              </p>
              <Link to="/" className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition">
                Upload Video
              </Link>
            </div>
          ) : !selectedVideo ? (
            <div className="flex flex-col items-center justify-center h-full">
               <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="p-8 max-w-5xl mx-auto pb-24">
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-white mb-2">{selectedVideo.filename}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>Uploaded: {new Date(selectedVideo.upload_time).toLocaleString()}</span>
                  <span>•</span>
                  <span>ID: {(selectedVideo.video_id || selectedVideo.id || 'N/A').split('-')[0]}...</span>
                </div>
              </div>

              {selectedVideo.status === 'pending' && (
                <div className="border border-slate-700 bg-slate-800 rounded-xl p-12 text-center shadow-lg">
                  <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2">Click Analyse to process this video</h3>
                  <p className="text-slate-400 mb-6">Our AI will review the footage, detect people, and flag any loitering activity.</p>
                  <button onClick={() => startAnalysis(selectedVideo.video_id || selectedVideo.id)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-md transition-all duration-200">
                    Analyse Footage
                  </button>
                </div>
              )}

              {selectedVideo.status === 'processing' && (
                <div className="border border-indigo-900/50 bg-indigo-900/10 rounded-xl p-16 text-center">
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <svg className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">Analysing your footage...</h3>
                  <p className="text-indigo-300">Searching for activity and loitering patterns.</p>
                </div>
              )}

              {selectedVideo.status === 'error' && (
                <div className="border border-red-800 bg-red-900/20 rounded-xl p-8 text-center text-red-200">
                  <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <h3 className="text-xl font-bold text-white mb-2">Analysis Failed</h3>
                  <p className="mb-6">{selectedVideo.error_msg || 'An unknown error occurred during video processing.'}</p>
                  <button onClick={() => startAnalysis(selectedVideo.video_id || selectedVideo.id)} className="px-6 py-2 bg-red-800 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200">
                    Retry Analysis
                  </button>
                </div>
              )}

              {selectedVideo.status === 'done' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Stats Bar */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                      <div className="text-sm text-slate-400 mb-1 font-medium">Total Events</div>
                      <div className="text-3xl font-bold text-white">{events.length}</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                      <div className="text-sm text-slate-400 mb-1 font-medium">Loitering Alerts</div>
                      <div className={`text-3xl font-bold ${alerts.length > 0 ? 'text-red-400' : 'text-slate-300'}`}>{alerts.length}</div>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
                      <div className="text-sm text-slate-400 mb-1 font-medium">Footage Reviewed</div>
                      <div className="text-3xl font-bold text-white">{formatTime(selectedVideo.duration_s || 0)}</div>
                    </div>
                  </div>

                  {events.length === 0 ? (
                    <div className="border border-slate-700/50 bg-slate-800/30 rounded-xl p-16 text-center">
                       <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                       </svg>
                       <h3 className="text-xl font-semibold text-slate-300 mb-2">No activity detected</h3>
                       <p className="text-slate-500">The AI scanned the footage but did not detect any persons.</p>
                    </div>
                  ) : (
                    <div className="space-y-8 relative">
                      
                      {/* Alerts Section (Only if alerts > 0) */}
                      {alerts.length > 0 && (
                        <div>
                          <h3 className="text-lg font-bold text-red-500 mb-4 flex items-center gap-2 border-b border-red-900 pb-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                             Critical Alerts Requires Review
                          </h3>
                          <div className="flex flex-col gap-4">
                            {alerts.map(a => <EventCard key={`alert-${a.id}`} event={a} isAlert={true} />)}
                          </div>
                        </div>
                      )}

                      {/* Standard Timeline container */}
                      <div>
                        {alerts.length > 0 && <h3 className="text-lg font-semibold text-white mt-8 mb-4 border-b border-slate-700 pb-2">All Activity</h3>}
                        {/* the left vertical line using absolute positioning relative to container if we want, but simple gap list works too based on ref design. Sticking to clean stacked cards for robustness */}
                        <div className="flex flex-col gap-4 border-l-2 border-slate-700/50 pl-4 py-2 ml-4">
                           {events.map(e => <EventCard key={`event-${e.id}`} event={e} isAlert={e.flagged} />)}
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Clip Modal */}
      {modalEvent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEvent(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full shadow-2xl relative overflow-hidden">
            <button 
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-red-500 rounded-full text-white transition-colors"
              onClick={() => setModalEvent(null)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="bg-black aspect-video w-full flex items-center justify-center relative">
              <video 
                src={`http://localhost:8000/api/clips/${modalEvent.id}`} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
                onError={(e) => { e.target.outerHTML = "<div class='text-red-500 p-8'>Clip could not be loaded</div>" }}
              />
            </div>
            
            <div className="p-6 border-t border-slate-800">
               <div className="flex justify-between items-start">
                  <div>
                    {modalEvent.flagged ? (
                      <h4 className="text-xl font-bold text-red-500 mb-1 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span> Loitering Alert Recorded
                      </h4>
                    ) : (
                      <h4 className="text-xl font-semibold text-white mb-1">Person Detected</h4>
                    )}
                    <div className="text-slate-400">
                      Timestamp: <span className="font-semibold text-slate-200">at {formatTime(modalEvent.start_time)}</span> 
                      {modalEvent.duration_s && `  •  Duration: ${formatMinutes(modalEvent.duration_s)}m ${Math.floor(modalEvent.duration_s % 60)}s`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-500 mb-1">AI Confidence</div>
                    <div className="text-lg font-mono font-bold text-indigo-400">{Math.round(modalEvent.confidence * 100)}%</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
