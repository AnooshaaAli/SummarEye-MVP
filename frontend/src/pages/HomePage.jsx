import { Link } from 'react-router-dom';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background Glow Effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="z-10 text-center max-w-3xl px-6">
                <div className="flex items-center justify-center gap-4 mb-8">
                    <div className="relative">
                        <svg className="w-16 h-16 text-indigo-500 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                        </svg>
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-40 animate-pulse"></div>
                    </div>
                    <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-lg">
                        Summar<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Eye</span> <span className="text-slate-300 font-light">AI</span>
                    </h1>
                </div>

                <p className="text-xl text-slate-400 mb-12 font-medium leading-relaxed drop-shadow-sm">
                    Intelligent video analysis. <br /> Upload your CCTV footage and get a smart event timeline instantly. Let AI do the scrubbing for you.
                </p>

                <Link
                    to="/dashboard"
                    className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-white transition-all duration-300 bg-indigo-600 rounded-full hover:bg-indigo-500 hover:scale-105 shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                    <span className="text-lg tracking-wide">Continue to Dashboard</span>
                    <svg className="w-6 h-6 ml-3 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                </Link>
            </div>

        </div>
    );
}
