import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import NeuralNetworkAnimation from '../components/NeuralNetworkAnimation';
import { trackEvent } from '../utils/tracker';

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
  const [clipError, setClipError] = useState(false);
  const [showLimitations, setShowLimitations] = useState(false);

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

  // Helper to detect network errors
  const isNetworkError = (error) => {
    return error instanceof TypeError && error.message === 'Failed to fetch';
  };

  // API Fetches
  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem('summareye_token');
      const res = await fetch('/api/videos', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (e) {
      console.error('fetchVideos error:', e);
      if (isNetworkError(e)) {
        showToast('CONNECTION_REFUSED: Backend unreachable.', 'error');
      }
    }
  };

  const fetchVideoDetails = async (id) => {
    try {
      const token = localStorage.getItem('summareye_token');
      const res = await fetch(`/api/videos/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.error('fetchVideoDetails error:', e);
      if (isNetworkError(e)) {
        showToast('CONNECTION_REFUSED: Backend unreachable.', 'error');
      }
    }
    return null;
  };

  const fetchEventsAndAlerts = async (id) => {
    try {
      const token = localStorage.getItem('summareye_token');
      const [eventsRes, alertsRes] = await Promise.all([
        fetch(`/api/videos/${id}/events`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/videos/${id}/alerts`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (eventsRes.ok && alertsRes.ok) {
        const eventsData = await eventsRes.json();
        const alertsData = await alertsRes.json();
        setEvents(eventsData);
        setAlerts(alertsData);
      }
    } catch (e) {
      console.error('fetchEventsAndAlerts error:', e);
      if (isNetworkError(e)) {
        showToast('CONNECTION_REFUSED: Backend unreachable.', 'error');
      }
    }
  };

  const startAnalysis = async (id) => {
    try {
      const token = localStorage.getItem('summareye_token');
      const res = await fetch(`/api/analyse/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('> Analysis pipeline initiated', 'success');
        const updatedVideo = await fetchVideoDetails(id);
        if (updatedVideo) {
          setSelectedVideo(updatedVideo);
          fetchVideos();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to start analysis', 'error');
      }
    } catch (e) {
      console.error('startAnalysis error:', e);
      if (isNetworkError(e)) {
        showToast('CONNECTION_REFUSED: Backend unreachable.', 'error');
      } else {
        showToast('Error starting analysis', 'error');
      }
    }
  };

  const deleteVideo = async (id) => {
    if (!window.confirm("CONFIRM: Permanently delete this video and all its analysis data?")) return;

    try {
      const token = localStorage.getItem('summareye_token');
      const res = await fetch(`/api/videos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('> Video purged from system', 'success');
        setSelectedVideoId(null);
        setSelectedVideo(null);
        setEvents([]);
        setAlerts([]);
        fetchVideos();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to delete video', 'error');
      }
    } catch (e) {
      console.error('deleteVideo error:', e);
      if (isNetworkError(e)) {
        showToast('CONNECTION_REFUSED: Backend unreachable.', 'error');
      } else {
        showToast('Failed to delete video', 'error');
      }
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
      trackEvent('result_viewed', { video_id: id });
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
              showToast(`> Analysis complete — ${updated.event_count || 0} event(s) detected`, 'success');
            } else if (updated.status === 'error') {
              showToast('> Analysis failed', 'error');
            }
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [selectedVideo]);

  // View clip handler
  const handleViewClip = (event) => {
    if (!event.clip_path) {
      showToast('Clip not yet available', 'error');
      return;
    }
    trackEvent('clip_viewed', { event_id: event.id, label: event.label });
    setClipError(false);
    setModalEvent(event);
  };

  // Thumbnail Placeholder
  const ThumbnailPlaceholder = () => (
    <div className="w-full h-full flex items-center justify-center bg-neon-panel border border-neon-border">
      <svg className="w-6 h-6 text-neon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
      </svg>
    </div>
  );

  // Event Card Component
  const EventCard = ({ event, isAlert }) => {
    const [thumbFailed, setThumbFailed] = useState(false);

    let confidenceClass = 'border-hacker-red text-hacker-red';
    let confText = `${Math.round(event.confidence * 100)}% — verify`;
    if (event.confidence >= 0.8) {
      confidenceClass = 'border-neon-green text-neon-green';
      confText = `${Math.round(event.confidence * 100)}%`;
    } else if (event.confidence >= 0.5) {
      confidenceClass = 'border-hacker-yellow text-hacker-yellow';
      confText = `${Math.round(event.confidence * 100)}%`;
    }

    return (
      <div className={`p-4 rounded bg-neon-panel border ${isAlert ? 'border-l-4 border-l-hacker-red border-neon-border glow-red' : 'border-neon-border'} flex gap-4 mt-3`}>
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-24 h-20 bg-black rounded overflow-hidden">
          {thumbFailed ? (
            <ThumbnailPlaceholder />
          ) : (
            <img
              src={`/api/thumbnails/${event.id}`}
              alt="Event Thumbnail"
              className="w-full h-full object-cover"
              onError={() => setThumbFailed(true)}
            />
          )}
        </div>
        {/* Details */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              {isAlert ? (
                <div className={`font-bold text-xs mb-1 animate-pulse flex items-center gap-2 ${event.label === 'weapon_detected' ? 'text-hacker-red' : 'text-hacker-red'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-hacker-red"></span>
                  {event.label === 'weapon_detected' ? 'WEAPON DETECTED' : 'LOITERING ALERT'}
                </div>
              ) : (
                <div className="text-neon-dim text-xs mb-1 font-bold uppercase tracking-wider">
                  Person Detected
                </div>
              )}
              <div className="text-neon-green text-sm">
                <span className="text-neon-dark">time:</span> {formatTime(event.start_time)}
              </div>
              {isAlert && (
                <div className="text-hacker-red text-xs mt-1">
                  duration: {formatMinutes(event.duration_s)}m
                </div>
              )}
            </div>

            <div className={`px-2 py-0.5 text-[10px] border rounded font-bold ${confidenceClass}`}>
              {confText}
            </div>
          </div>
          <div className="mt-2 text-right">
            <button
              onClick={() => handleViewClip(event)}
              className="px-3 py-1.5 bg-black text-neon-green hover:bg-neon-green hover:text-black rounded text-xs transition-all duration-200 font-bold border border-neon-border hover:border-neon-green"
            >
              {'>'} View Clip
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'done': return <span className="border border-neon-green text-neon-green px-2 py-0.5 rounded text-[10px] ml-auto font-bold">DONE</span>;
      case 'processing': return <span className="border border-hacker-yellow text-hacker-yellow px-2 py-0.5 rounded text-[10px] ml-auto font-bold flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-hacker-yellow animate-pulse"></span>PROC</span>;
      case 'error': return <span className="border border-hacker-red text-hacker-red px-2 py-0.5 rounded text-[10px] ml-auto font-bold">ERR</span>;
      case 'pending': return <span className="border border-neon-dark text-neon-dark px-2 py-0.5 rounded text-[10px] ml-auto font-bold">PEND</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-neon-dim font-mono">
      <Navbar />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-16 right-4 px-4 py-3 rounded border z-50 text-xs font-mono ${toast.type === 'success'
            ? 'bg-black border-neon-green text-neon-green glow-green'
            : 'bg-black border-hacker-red text-hacker-red glow-red'
          }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Sidebar */}
        <aside className="w-72 bg-neon-panel border-r border-neon-border flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-neon-border bg-black sticky top-0">
            <h2 className="text-[10px] font-bold text-neon-green uppercase tracking-widest">{'>'} Footage Library</h2>
          </div>

          {isInitialLoad ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-neon-dark/20 animate-pulse rounded border border-neon-border"></div>)}
            </div>
          ) : (
            <div className="flex flex-col p-2 gap-1">
              {videos.length === 0 ? (
                <div className="p-4 text-xs text-neon-dark text-center">No footage uploaded.</div>
              ) : (
                videos.map(v => {
                  const vidId = v.video_id || v.id;
                  return (
                    <button
                      key={vidId}
                      onClick={() => handleSelectVideo(vidId)}
                      className={`flex flex-col text-left p-3 rounded transition-colors ${selectedVideoId === vidId
                          ? 'bg-neon-dark/30 border border-neon-green glow-green'
                          : 'hover:bg-neon-dark/10 border border-transparent'
                        }`}
                    >
                      <div className="flex items-start w-full gap-2">
                        <span className="font-medium text-xs text-neon-green truncate flex-1" title={v.filename}>{v.filename}</span>
                        {getStatusBadge(v.status)}
                      </div>
                      <span className="text-[10px] text-neon-dark mt-1">{new Date(v.upload_time).toLocaleDateString()}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-black relative">
          <div className="absolute inset-0 grid-bg pointer-events-none opacity-50"></div>

          {!selectedVideoId ? (
            <div className="flex flex-col items-center justify-center h-full text-center relative z-10">
              <div className="text-neon-dark text-4xl mb-4 font-bold">{'///'}</div>
              <h2 className="text-lg font-bold text-neon-dim mb-2">No footage selected</h2>
              <p className="text-neon-dark text-xs max-w-md">
                Select a video from the library to view its analysis results.
              </p>
              <Link to="/upload" className="mt-6 px-6 py-2 border border-neon-green text-neon-green hover:bg-neon-green hover:text-black rounded text-xs font-bold uppercase tracking-wider transition-all">
                {'>'} Upload Video
              </Link>
            </div>
          ) : !selectedVideo ? (
            <div className="flex flex-col items-center justify-center h-full relative z-10">
              <div className="w-8 h-8 border-2 border-neon-green border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="p-8 max-w-5xl mx-auto pb-24 relative z-10">
              {/* Video Header */}
              <div className="mb-8 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-neon-green text-glow-green mb-1">{selectedVideo.filename}</h2>
                  <div className="flex items-center gap-3 text-[10px] text-neon-dark">
                    <span>uploaded: {new Date(selectedVideo.upload_time).toLocaleString()}</span>
                    <span>|</span>
                    <span>id: {(selectedVideo.video_id || selectedVideo.id || 'N/A').split('-')[0]}...</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteVideo(selectedVideo.video_id || selectedVideo.id)}
                  className="px-3 py-1.5 border border-hacker-red text-hacker-red hover:bg-hacker-red hover:text-black rounded text-xs font-bold transition-all flex items-center gap-2"
                  title="Permanently delete this video"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  Delete
                </button>
              </div>

              {/* Pending State */}
              {selectedVideo.status === 'pending' && (
                <div className="border border-neon-border bg-neon-panel rounded-xl p-12 text-center">
                  <div className="text-neon-dark text-4xl mb-4">{'[▶]'}</div>
                  <h3 className="text-lg font-bold text-neon-green mb-2">Ready for Analysis</h3>
                  <p className="text-neon-dim text-xs mb-6">Initiate the AI detection pipeline to scan this footage.</p>
                  <button
                    onClick={() => startAnalysis(selectedVideo.video_id || selectedVideo.id)}
                    className="px-8 py-3 border-2 border-neon-green text-neon-green font-bold text-sm uppercase tracking-wider rounded hover:bg-neon-green hover:text-black transition-all duration-300 glow-green"
                  >
                    {'>'} Analyse Footage
                  </button>
                </div>
              )}

              {/* Processing State — NEURAL NETWORK ANIMATION */}
              {selectedVideo.status === 'processing' && (
                <NeuralNetworkAnimation />
              )}

              {/* Error State */}
              {selectedVideo.status === 'error' && (
                <div className="border border-hacker-red bg-black rounded-xl p-8 text-center glow-red">
                  <div className="text-hacker-red text-3xl mb-4">{'[!]'}</div>
                  <h3 className="text-lg font-bold text-hacker-red mb-2">Analysis Failed</h3>
                  <p className="text-hacker-red/70 text-xs mb-6 font-mono">{selectedVideo.error_msg || 'UNKNOWN_ERROR'}</p>
                  <button
                    onClick={() => startAnalysis(selectedVideo.video_id || selectedVideo.id)}
                    className="px-6 py-2 border border-hacker-red text-hacker-red hover:bg-hacker-red hover:text-black font-bold rounded text-xs transition-all"
                  >
                    {'>'} Retry Analysis
                  </button>
                </div>
              )}

              {/* Done State — Results */}
              {selectedVideo.status === 'done' && (
                <div>
                  {/* Stats Bar */}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-neon-panel border border-neon-border p-4 rounded">
                      <div className="text-[10px] text-neon-dark mb-1 uppercase tracking-wider">Total Events</div>
                      <div className="text-2xl font-bold text-neon-green text-glow-green">{events.length}</div>
                    </div>
                    <div className="bg-neon-panel border border-neon-border p-4 rounded">
                      <div className="text-[10px] text-neon-dark mb-1 uppercase tracking-wider">Critical Alerts</div>
                      <div className={`text-2xl font-bold ${alerts.length > 0 ? 'text-hacker-red text-glow-red' : 'text-neon-dim'}`}>{alerts.length}</div>
                    </div>
                    <div className="bg-neon-panel border border-neon-border p-4 rounded">
                      <div className="text-[10px] text-neon-dark mb-1 uppercase tracking-wider">Footage Duration</div>
                      <div className="text-2xl font-bold text-neon-green">{formatTime(selectedVideo.duration_s || 0)}</div>
                    </div>
                  </div>

                  {events.length === 0 ? (
                    <div className="border border-neon-border bg-neon-panel rounded-xl p-16 text-center">
                      <div className="text-neon-dark text-2xl mb-4">{'[✓]'}</div>
                      <h3 className="text-lg font-bold text-neon-dim mb-2">No activity detected</h3>
                      <p className="text-neon-dark text-xs">The AI scanned the footage but did not detect any persons.</p>
                    </div>
                  ) : (
                    <div className="space-y-8 relative">
                      {/* Alerts Section */}
                      {alerts.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-hacker-red mb-3 flex items-center gap-2 border-b border-hacker-red/30 pb-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-hacker-red animate-pulse"></span>
                            {'>'} CRITICAL ALERTS — REVIEW REQUIRED
                          </h3>
                          <div className="flex flex-col">
                            {alerts.map(a => <EventCard key={`alert-${a.id}`} event={a} isAlert={true} />)}
                          </div>
                        </div>
                      )}

                      {/* All Events */}
                      <div>
                        {alerts.length > 0 && <h3 className="text-sm font-bold text-neon-green mt-8 mb-3 border-b border-neon-border pb-2">{'>'} All Activity</h3>}
                        <div className="flex flex-col border-l-2 border-neon-border/30 pl-4 py-2 ml-4">
                          {events.map(e => <EventCard key={`event-${e.id}`} event={e} isAlert={e.flagged} />)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* About Detection — collapsible */}
                  <div className="mt-12 border border-neon-border rounded overflow-hidden">
                    <button
                      onClick={() => setShowLimitations(!showLimitations)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-neon-panel hover:bg-neon-dark/20 transition-colors text-left"
                    >
                      <span className="text-neon-dark text-[10px] uppercase tracking-wider font-bold">{'>'} About Detection Accuracy</span>
                      <svg className={`w-3 h-3 text-neon-dark transition-transform ${showLimitations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </button>
                    {showLimitations && (
                      <div className="px-4 py-3 bg-black border-t border-neon-border">
                        <ul className="space-y-1 text-[10px] text-neon-dark">
                          <li>• Person detection: ~85–90% accuracy on clear, well-lit footage</li>
                          <li>• Accuracy reduces in low light, heavy shadows, or very small subjects</li>
                          <li>• Processing: ~15–30 seconds per minute of footage</li>
                          <li>• Loitering threshold: 15 continuous minutes</li>
                          <li>• Supported: MP4, AVI, MOV | Max size: 500MB</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Clip Modal */}
      {modalEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEvent(null);
          }}
        >
          <div className="bg-neon-panel border border-neon-border rounded-lg max-w-4xl w-full shadow-2xl relative overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-2 bg-black border-b border-neon-border">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-hacker-red"></span>
                <span className="w-2 h-2 rounded-full bg-hacker-yellow"></span>
                <span className="w-2 h-2 rounded-full bg-neon-green"></span>
                <span className="ml-2 text-[10px] text-neon-dark">clip_viewer.exe</span>
              </div>
              <button
                className="text-neon-dim hover:text-hacker-red transition-colors text-xs"
                onClick={() => setModalEvent(null)}
              >
                [✕] close
              </button>
            </div>

            <div className="bg-black aspect-video w-full flex items-center justify-center relative">
              {clipError ? (
                <div className="flex flex-col items-center gap-3 text-neon-dark">
                  <div className="text-3xl">{'[✕]'}</div>
                  <p className="text-sm font-medium">Clip unavailable</p>
                  <p className="text-xs">The video clip could not be loaded.</p>
                </div>
              ) : (
                <video
                  src={`/api/clips/${modalEvent.id}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  onError={() => setClipError(true)}
                />
              )}
            </div>

            <div className="p-4 border-t border-neon-border">
              <div className="flex justify-between items-start">
                <div>
                  {modalEvent.flagged ? (
                    <h4 className="text-sm font-bold text-hacker-red mb-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-hacker-red animate-pulse"></span>
                      {modalEvent.label === 'weapon_detected' ? 'WEAPON ALERT' : 'LOITERING ALERT'}
                    </h4>
                  ) : (
                    <h4 className="text-sm font-bold text-neon-green mb-1">Person Detected</h4>
                  )}
                  <div className="text-neon-dim text-xs">
                    <span className="text-neon-dark">time:</span> {formatTime(modalEvent.start_time)}
                    {modalEvent.duration_s && <span className="ml-3"><span className="text-neon-dark">dur:</span> {formatMinutes(modalEvent.duration_s)}m {Math.floor(modalEvent.duration_s % 60)}s</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-neon-dark uppercase">Confidence</div>
                  <div className="text-lg font-bold text-neon-green">{Math.round(modalEvent.confidence * 100)}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
