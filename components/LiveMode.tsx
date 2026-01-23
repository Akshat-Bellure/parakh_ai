import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Video, VideoOff, Activity, X } from 'lucide-react';
import { createPcmBlob, decodeAudioData, arrayBufferToBase64 } from '../services/audioUtils';

const LiveMode: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null); // To hold the live session
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const frameIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize connection
  const connect = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      inputContextRef.current = inputCtx;
      audioContextRef.current = outputCtx;
      
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // Get User Media (Audio + Video if selected)
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: true // Always get video permissions, but manage sending frames manually
      });
      streamRef.current = stream;

      if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true; // Local preview muted
      }

      // Connect to Live API
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
            },
            systemInstruction: "You are a friendly, witty, and helpful AI assistant. You can see and hear the user.",
        },
        callbacks: {
            onopen: () => {
                setIsConnected(true);
                
                // Audio Input Processing
                const source = inputCtx.createMediaStreamSource(stream);
                const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                scriptProcessor.onaudioprocess = (e) => {
                    if (isMuted) return; 
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createPcmBlob(inputData);
                    sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                };
                
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
                // Handle Audio Output
                const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (base64Audio && outputCtx) {
                    const audioBuffer = await decodeAudioData(
                        new Uint8Array(atob(base64Audio).split('').map(c => c.charCodeAt(0))),
                        outputCtx
                    );
                    
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputNode);
                    
                    // Simple scheduling
                    const currentTime = outputCtx.currentTime;
                    const startTime = Math.max(currentTime, nextStartTimeRef.current);
                    source.start(startTime);
                    nextStartTimeRef.current = startTime + audioBuffer.duration;
                    
                    source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                    });
                    sourcesRef.current.add(source);
                }

                // Handle Interruption
                if (msg.serverContent?.interrupted) {
                    sourcesRef.current.forEach(s => s.stop());
                    sourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }
            },
            onclose: () => {
                setIsConnected(false);
                cleanup();
            },
            onerror: (e) => {
                console.error("Live API Error:", e);
                setError("Connection failed.");
                cleanup();
            }
        }
      });
      
      sessionRef.current = sessionPromise;

      // Video Frame Loop
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');
      const videoEl = videoRef.current;

      frameIntervalRef.current = window.setInterval(async () => {
        if (isVideoEnabled && videoEl && ctx && isConnected) {
             canvas.width = videoEl.videoWidth;
             canvas.height = videoEl.videoHeight;
             ctx.drawImage(videoEl, 0, 0);
             
             const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
             
             sessionPromise.then(session => {
                 session.sendRealtimeInput({
                     media: {
                         mimeType: 'image/jpeg',
                         data: base64Data
                     }
                 });
             });
        }
      }, 1000); // 1 FPS for simplicity/bandwidth

    } catch (e: any) {
        console.error(e);
        setError(e.message || "Could not access media devices.");
    }
  };

  const cleanup = () => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (inputContextRef.current) inputContextRef.current.close();
    if (audioContextRef.current) audioContextRef.current.close();
    
    // Close session if possible (wrapper doesn't expose clean close method easily on promise, 
    // but the stream tracks stop will kill input).
    setIsConnected(false);
  };

  const toggleDisconnect = () => {
      cleanup();
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Activity className="w-6 h-6 text-red-500" />
                Gemini Live
            </h2>
            {isConnected && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-mono animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    LIVE
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
            {/* Video Preview */}
            <video 
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-500 ${isVideoEnabled ? 'opacity-100' : 'opacity-20'}`}
            />
            
            {/* Center Animation when no video */}
            {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center ${isConnected ? 'bg-red-500/10' : 'bg-zinc-800'}`}>
                        {isConnected ? (
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                                <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                                    <Mic className="w-10 h-10 text-white" />
                                </div>
                            </div>
                        ) : (
                            <MicOff className="w-10 h-10 text-zinc-600" />
                        )}
                    </div>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                    <div className="bg-zinc-900 p-6 rounded-xl border border-red-900 text-center max-w-sm">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button onClick={() => setError(null)} className="px-4 py-2 bg-zinc-800 rounded text-sm">Close</button>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 z-10">
                {!isConnected ? (
                    <button 
                        onClick={connect}
                        className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-900/40 transition-all hover:scale-105"
                    >
                        Start Live Session
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-xl transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
                        >
                            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>
                        
                        <button 
                            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                            className={`p-4 rounded-xl transition-all ${!isVideoEnabled ? 'bg-zinc-800 text-zinc-500' : 'bg-white text-black hover:bg-zinc-200'}`}
                        >
                            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                        </button>

                        <button 
                            onClick={toggleDisconnect}
                            className="p-4 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/50"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>
        </div>
        
        <p className="text-center text-zinc-500 text-xs mt-4">
            Gemini Live Native Audio Preview • 12-2025 • Experimental
        </p>
    </div>
  );
};

export default LiveMode;