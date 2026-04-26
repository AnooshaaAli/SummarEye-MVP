export const trackEvent = async (eventName, metadata = {}) => {
  try {
    const token = localStorage.getItem('summareye_token');
    if (!token) return;
    await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ event_name: eventName, metadata })
    });
  } catch (error) {
    console.error('Tracking failed:', error);
  }
};
