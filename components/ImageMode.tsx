import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Image as ImageIcon, Download, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { GeneratedImage } from '../types';

const ImageMode: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using Imagen 3 models via generateImages
      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio,
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const imageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${imageBytes}`;
        
        setGeneratedImage({
            id: Date.now().toString(),
            url: imageUrl,
            prompt: prompt,
            createdAt: Date.now()
        });
      } else {
        throw new Error("No image generated");
      }

    } catch (err: any) {
        console.error("Image gen error:", err);
        setError(err.message || "Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* Controls Sidebar */}
      <div className="w-80 border-r border-zinc-800 p-6 flex flex-col gap-6 overflow-y-auto bg-zinc-900/30">
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            Image Studio
          </h2>
          <p className="text-sm text-zinc-500">Powered by Imagen 4.0</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic city with flying cars, neon lights, cyberpunk style..."
              className="w-full h-32 bg-zinc-800 rounded-xl border border-zinc-700 p-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    aspectRatio === ratio
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl font-semibold text-white shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate
          </button>
          
          {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
              </div>
          )}
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5 relative">
        {!generatedImage && !isGenerating && (
            <div className="text-center text-zinc-600">
                <ImageIcon className="w-24 h-24 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Ready to create</p>
                <p className="text-sm">Enter a prompt to start generating high-quality images</p>
            </div>
        )}

        {isGenerating && (
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                    </div>
                </div>
                <p className="text-zinc-400 animate-pulse">Dreaming up your image...</p>
            </div>
        )}

        {generatedImage && !isGenerating && (
            <div className="relative group max-w-full max-h-full">
                <img 
                    src={generatedImage.url} 
                    alt={generatedImage.prompt} 
                    className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-zinc-800"
                />
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a 
                        href={generatedImage.url} 
                        download={`gemini-image-${Date.now()}.jpg`}
                        className="p-3 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-colors block"
                    >
                        <Download className="w-5 h-5" />
                    </a>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ImageMode;