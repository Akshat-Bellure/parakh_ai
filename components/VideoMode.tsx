import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Video, Loader2, Play, AlertTriangle, Key } from 'lucide-react';

const VideoMode: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [needsKeySelection, setNeedsKeySelection] = useState(false);

  useEffect(() => {
    checkApiKeySelection();
  }, []);

  const checkApiKeySelection = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setNeedsKeySelection(!hasKey);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions
      setNeedsKeySelection(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // Double check key before generating
    if (needsKeySelection) {
        await handleSelectKey();
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setStatusMessage('Initializing video generation...');

    try {
        // Create new instance to ensure key is fresh
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        setStatusMessage('Video is rendering. This may take a moment...');

        // Polling loop
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
            operation = await ai.operations.getVideosOperation({operation: operation});
            setStatusMessage('Still rendering... Veo is working its magic.');
        }

        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
            const downloadLink = operation.response.generatedVideos[0].video.uri;
            // Fetch with API key appended
            const videoRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoRes.ok) throw new Error("Failed to download video bytes");
            
            const blob = await videoRes.blob();
            const url = URL.createObjectURL(blob);
            setVideoUrl(url);
        } else {
            throw new Error("No video URI returned from operation");
        }

    } catch (err: any) {
        console.error("Video gen error:", err);
        if (err.message && err.message.includes("Requested entity was not found")) {
            setNeedsKeySelection(true);
            setError("API Key issue detected. Please re-select your project.");
        } else {
            setError(err.message || "Failed to generate video.");
        }
    } finally {
        setIsGenerating(false);
        setStatusMessage('');
    }
  };

  if (needsKeySelection) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-zinc-950 text-zinc-100 p-8 text-center">
              <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 max-w-md w-full shadow-2xl">
                  <Key className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Billing Project Required</h2>
                  <p className="text-zinc-400 mb-6">
                      Veo video generation requires a paid Google Cloud Project. Please select your project to continue.
                  </p>
                  <button 
                    onClick={handleSelectKey}
                    className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-semibold transition-colors"
                  >
                      Select API Key
                  </button>
                  <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block mt-4 text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                      Learn more about billing
                  </a>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Video className="w-6 h-6 text-green-400" />
                Veo Video Generator
            </h2>
            <div className="text-xs px-2 py-1 bg-green-900/30 border border-green-800 text-green-400 rounded">
                Veo 3.1 Fast
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-8">
                
                {/* Input Section */}
                <div className="space-y-4">
                    <label className="text-sm font-medium text-zinc-400">Describe your video</label>
                    <div className="relative">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A neon hologram of a cat driving at top speed in a cyberpunk city..."
                            className="w-full h-32 bg-zinc-900 rounded-xl border border-zinc-700 p-4 focus:ring-2 focus:ring-green-500 focus:outline-none resize-none text-lg"
                            disabled={isGenerating}
                        />
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt}
                            className="absolute bottom-4 right-4 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Generate Video
                        </button>
                    </div>
                </div>

                {/* Status / Error */}
                {isGenerating && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center animate-pulse">
                         <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" />
                         <p className="text-green-400 font-medium">{statusMessage}</p>
                         <p className="text-zinc-500 text-sm mt-2">This process typically takes 1-2 minutes.</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3 text-red-200">
                        <AlertTriangle className="w-5 h-5" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Result */}
                {videoUrl && (
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium text-zinc-300">Generated Video</h3>
                        <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
                            <video 
                                src={videoUrl} 
                                controls 
                                autoPlay 
                                loop 
                                className="w-full aspect-video object-contain"
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default VideoMode;