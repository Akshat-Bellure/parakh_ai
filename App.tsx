import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { Tab, ScanState, AnalysisResult, ChatMessage, LabTest } from './types';

// --- CONFIG & PROMPTS ---

const PROMPT_SCORING = (lang: string) => `
ROLE: You are the Parakh AI Scoring Engine (Regulatory-Hardened).
TASK: Analyze the image (Medicine/Food/Cosmetic) and output a valid JSON rating.
LANGUAGE: ${lang} (Clear, Simple, Scientific).

ALGORITHM:
1. Identify Product & Ingredients.
2. Assign Sub-Scores (0-100):
   - Safety (50%): Penalize for toxins, banned items (CDSCO/FSSAI/WHO), allergens.
   - Purity (30%): Penalize for fillers, sugar, processed additives.
   - Efficacy (20%): Does it actually work based on ingredients?
3. Calculate Final Score: (Safety*0.5 + Purity*0.3 + Efficacy*0.2) / 10.
4. Strict Gating: If ANY banned substance is found, Score = 0.

OUTPUT FORMAT: Provide ONLY the JSON object. Do not wrap in markdown code blocks.
JSON Structure:
{
    "category": "MEDICINE | FOOD | COSMETIC | AYURVEDA | OBJECT",
    "title": "Product Name",
    "subtitle": "Short Description",
    "score_final": number (0-10, 1 decimal),
    "scores": { "safety": number, "purity": number, "efficacy": number },
    "verdict_type": "safe | warning | danger",
    "verdict_text": "One sentence summary.",
    "scientific_context": "Markdown explanation. Cite logic.",
    "components": [
        {"name": "Ingredient", "status": "safe/caution/danger", "reason": "Why?"}
    ]
}
`;

const PROMPT_LAB = (item: string) => `
Generate a DIY Purity Test for '${item}' using common household items (Water, Fire, Iodine).
Output Markdown. Keep it safe, simple, step-by-step.
Structure: "**Goal**", "**You Need**", "**Steps**", "**Result Interpretation**".
`;

const PROMPT_CHAT = (query: string) => `
You are Parakh AI Regulatory Assistant. Answer strictly based on FSSAI/CDSCO/WHO guidelines.
Query: ${query}
Keep it short, factual, and include the disclaimer: "Informational only."
`;

const App: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [lang, setLang] = useState('Hinglish');
  
  // Scanner State
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([{
    role: 'ai',
    text: 'Hello! I am Parakh. I can check regulations (FSSAI/CDSCO) or explain ingredients.\n\nEx: "Is Palm Oil safe for kids?", "What is E102?"'
  }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Lab State
  const [labContent, setLabContent] = useState<string | null>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [labTitle, setLabTitle] = useState('');

  // --- API HELPER ---
  const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- SCANNER LOGIC ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview and loading state
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const base64Data = (ev.target?.result as string).split(',')[1];
        setScanImage(ev.target?.result as string);
        setScanState('scanning');
        
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-09-2025',
                contents: {
                    parts: [
                        { text: PROMPT_SCORING(lang) },
                        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                    ]
                },
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text || "{}";
            // Clean markdown blocks if present (though responseMimeType should handle it)
            const cleanText = text.replace(/```json\n|\n```/g, '');
            const result = JSON.parse(cleanText);
            setScanResult(result);
            setScanState('result');
        } catch (error) {
            console.error("Scan failed", error);
            alert("Analysis failed. Please try again.");
            setScanState('idle');
        }
    };
    reader.readAsDataURL(file);
  };

  const closeResult = () => {
      setScanState('idle');
      setScanResult(null);
      setScanImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- CHAT LOGIC ---
  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatInput.trim() || isChatLoading) return;

      const userMsg = chatInput;
      setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          const ai = getAI();
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-09-2025',
              contents: PROMPT_CHAT(userMsg)
          });
          
          setChatHistory(prev => [...prev, { role: 'ai', text: response.text || "I couldn't verify that." }]);
      } catch (err) {
          setChatHistory(prev => [...prev, { role: 'ai', text: "Connection error with Regulatory DB." }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- LAB LOGIC ---
  const generateLabTest = async (item: string) => {
      setLabTitle(item);
      setLabContent(null);
      setIsLabLoading(true);
      // Ensure we are on the lab tab logic (visual handled by state)
      
      try {
          const ai = getAI();
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-preview-09-2025',
              contents: PROMPT_LAB(item)
          });
          setLabContent(response.text || "Could not generate test.");
      } catch (err) {
          setLabContent("Error generating test protocol.");
      } finally {
          setIsLabLoading(false);
      }
  };

  // --- RENDER HELPERS ---
  const getScoreColor = (score: number) => {
      if (score >= 8) return '#10B981'; // Green
      if (score >= 5) return '#F59E0B'; // Yellow
      return '#EF4444'; // Red
  };

  // --- COMPONENT RENDER ---
  return (
    <div className="h-full flex flex-col bg-uber-black relative font-sans">
        
        {/* TOP NAVIGATION */}
        <nav className="fixed top-0 w-full z-50 bg-uber-black/90 backdrop-blur-md border-b border-uber-border px-5 py-4 flex justify-between items-center safe-area-top">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <i className="ph-bold ph-shield-check text-white text-lg"></i>
                </div>
                <div>
                    <h1 className="font-bold text-lg leading-none tracking-tight text-white">PARAKH <span className="text-uber-accent">AI</span></h1>
                    <p className="text-[9px] text-gray-500 font-mono tracking-wider mt-0.5">REGULATORY ENGINE v1.0</p>
                </div>
            </div>
            <div className="relative group">
                <select 
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="bg-uber-card text-xs font-bold rounded-full pl-3 pr-8 py-2 border border-uber-border outline-none focus:border-uber-accent transition-all appearance-none text-gray-300"
                >
                    <option value="Hinglish">🇮🇳 Hinglish</option>
                    <option value="English">🇬🇧 English</option>
                    <option value="Hindi">हिंदी</option>
                    <option value="Tamil">தமிழ்</option>
                    <option value="Telugu">తెలుగు</option>
                    <option value="Kannada">ಕನ್ನಡ</option>
                </select>
                <i className="ph-bold ph-caret-down absolute right-3 top-2.5 text-gray-500 text-xs pointer-events-none"></i>
            </div>
        </nav>

        {/* MAIN CONTENT */}
        <div className="flex-1 relative pt-20 pb-20 overflow-hidden">
            
            {/* TAB: SCAN */}
            {activeTab === 'scan' && (
                <div className="h-full flex flex-col animate-fade-in">
                    <div className="flex-1 relative flex items-center justify-center bg-uber-black mx-4 mb-4 rounded-3xl border border-uber-border overflow-hidden group">
                        
                        {/* IDLE STATE */}
                        {scanState === 'idle' && (
                            <div className="text-center px-6 relative z-10 space-y-6">
                                <div 
                                    className="relative w-40 h-40 mx-auto flex items-center justify-center cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="absolute inset-0 bg-uber-accent/10 rounded-full animate-pulse-slow"></div>
                                    <div className="absolute inset-0 bg-uber-accent/5 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                                    <div className="relative w-24 h-24 bg-uber-card rounded-2xl border border-uber-border flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-300">
                                        <i className="ph-duotone ph-camera text-4xl text-uber-accent"></i>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold text-white">Verify Product</h2>
                                    <p className="text-xs text-gray-500 max-w-[200px] mx-auto leading-relaxed">
                                        Scan Medicines, Food labels, or Cosmetics for a verified safety rating.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* SCANNING STATE */}
                        {(scanState === 'scanning' || scanState === 'result') && scanImage && (
                            <div className="absolute inset-0 bg-black">
                                <img src={scanImage} className="w-full h-full object-cover opacity-60" alt="Scan Preview" />
                                {scanState === 'scanning' && (
                                    <>
                                        <div className="absolute inset-0 z-20 overflow-hidden">
                                            <div className="w-full h-1/2 bg-gradient-to-b from-uber-accent/30 to-transparent animate-scan-sweep border-b border-uber-accent/50"></div>
                                        </div>
                                        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30">
                                            <span className="bg-black/80 backdrop-blur border border-white/10 text-white px-4 py-2 rounded-full text-xs font-mono tracking-widest flex items-center gap-2 shadow-xl">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                AI ANALYZING...
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="px-6">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handleFileChange} 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={scanState !== 'idle'}
                            className="w-full h-14 bg-white hover:bg-gray-200 text-black font-bold text-base rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-white/5 disabled:opacity-50"
                        >
                            {scanState === 'scanning' ? (
                                <>
                                    <i className="ph ph-spinner animate-spin text-lg"></i>
                                    <span>CALCULATING SCORE...</span>
                                </>
                            ) : (
                                <>
                                    <i className="ph-bold ph-aperture text-lg"></i>
                                    <span>SCAN & RATE</span>
                                </>
                            )}
                        </button>
                        <p className="text-[9px] text-gray-600 text-center mt-3 font-mono">
                            By scanning, you agree to our Terms. Not medical advice.
                        </p>
                    </div>
                </div>
            )}

            {/* TAB: CHAT */}
            {activeTab === 'chat' && (
                <div className="h-full flex flex-col bg-uber-black animate-fade-in">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.role === 'ai' ? 'bg-uber-accent/20' : 'bg-gray-700'}`}>
                                    <i className={`ph-fill ${msg.role === 'ai' ? 'ph-robot text-uber-accent' : 'ph-user text-gray-300'} text-xs`}></i>
                                </div>
                                <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'ai' ? 'bg-uber-card border border-uber-border text-gray-300 rounded-tl-none' : 'bg-uber-accent text-white rounded-tr-none'}`}>
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                             <div className="flex gap-3 max-w-[90%]">
                                <div className="w-8 h-8 rounded-full bg-uber-accent/20 flex-shrink-0 flex items-center justify-center mt-1">
                                    <i className="ph-fill ph-spinner animate-spin text-uber-accent text-xs"></i>
                                </div>
                             </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 bg-uber-black border-t border-uber-border">
                        <form onSubmit={handleSendMessage} className="relative">
                            <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask about safety regulations..." 
                                className="w-full bg-uber-card text-white rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-1 focus:ring-uber-accent text-sm border border-uber-border placeholder-gray-600"
                            />
                            <button type="submit" className="absolute right-2 top-2 p-1.5 bg-uber-accent rounded-lg text-white hover:bg-blue-600 transition-colors">
                                <i className="ph-bold ph-paper-plane-right"></i>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB: LAB */}
            {activeTab === 'lab' && (
                <div className="h-full overflow-y-auto p-6 animate-fade-in">
                    <h2 className="text-xl font-bold text-white mb-1">Magic Lab 🧪</h2>
                    <p className="text-xs text-gray-500 mb-6">Generate DIY purity tests instantly.</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        {[
                            { name: 'Milk Test', icon: '🥛', id: 'Milk' },
                            { name: 'Honey Purity', icon: '🍯', id: 'Honey' },
                            { name: 'Turmeric', icon: '🧡', id: 'Turmeric' },
                            { name: 'Ghee Check', icon: '🧈', id: 'Ghee' }
                        ].map((test) => (
                            <button 
                                key={test.id}
                                onClick={() => generateLabTest(test.id)}
                                className="bg-uber-card hover:bg-gray-900 border border-uber-border p-4 rounded-xl flex flex-col items-center gap-3 transition-all active:scale-95"
                            >
                                <span className="text-2xl">{test.icon}</span>
                                <span className="text-xs font-bold text-gray-300">{test.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* LAB RESULT */}
                    {(labContent || isLabLoading) && (
                         <div className="bg-uber-card border border-uber-border rounded-xl p-5 animate-fade-in">
                            <div className="flex justify-between items-start mb-4 border-b border-gray-800 pb-2">
                                <h3 className="font-bold text-white text-sm">{labTitle} Protocol</h3>
                                <button onClick={() => setLabContent(null)} className="text-gray-500"><i className="ph-bold ph-x"></i></button>
                            </div>
                            <div className="text-sm text-gray-400 leading-relaxed markdown-body">
                                {isLabLoading ? (
                                    <div className="flex items-center gap-2 text-uber-accent">
                                        <i className="ph ph-spinner animate-spin"></i>
                                        Generating step-by-step guide...
                                    </div>
                                ) : (
                                    <ReactMarkdown>{labContent || ''}</ReactMarkdown>
                                )}
                            </div>
                         </div>
                    )}
                </div>
            )}

        </div>

        {/* BOTTOM NAV */}
        <nav className="fixed bottom-0 w-full bg-uber-black/95 backdrop-blur border-t border-uber-border safe-area-bottom z-40">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => setActiveTab('scan')} className={`flex flex-col items-center gap-1 w-full h-full justify-center ${activeTab === 'scan' ? 'text-uber-accent' : 'text-gray-500'}`}>
                    <i className={`text-xl ${activeTab === 'scan' ? 'ph-fill ph-scan' : 'ph-bold ph-scan'}`}></i>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Scanner</span>
                </button>
                <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 w-full h-full justify-center ${activeTab === 'chat' ? 'text-uber-accent' : 'text-gray-500'}`}>
                    <i className={`text-xl ${activeTab === 'chat' ? 'ph-fill ph-chat-centered-text' : 'ph-bold ph-chat-centered-text'}`}></i>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Ask Expert</span>
                </button>
                <button onClick={() => setActiveTab('lab')} className={`flex flex-col items-center gap-1 w-full h-full justify-center ${activeTab === 'lab' ? 'text-uber-accent' : 'text-gray-500'}`}>
                    <i className={`text-xl ${activeTab === 'lab' ? 'ph-fill ph-flask' : 'ph-bold ph-flask'}`}></i>
                    <span className="text-[10px] font-bold uppercase tracking-wide">Magic Lab</span>
                </button>
            </div>
        </nav>

        {/* RESULT MODAL OVERLAY */}
        {scanState === 'result' && scanResult && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
                <div className="bg-[#0A0A0A] w-full max-w-lg h-[92vh] sm:h-[85vh] rounded-t-[2rem] sm:rounded-[2rem] border border-uber-border shadow-2xl flex flex-col transform transition-transform duration-500 ease-out">
                    
                    {/* Modal Header */}
                    <div className="flex-shrink-0 px-6 py-5 border-b border-uber-border flex justify-between items-center bg-[#0A0A0A] rounded-t-[2rem] sticky top-0 z-10">
                        <div>
                            <h2 className="font-bold text-lg text-white">Verified Report</h2>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">ID: SCAN_{Math.floor(Math.random()*10000)}</p>
                        </div>
                        <button onClick={closeResult} className="w-8 h-8 rounded-full bg-uber-card hover:bg-gray-800 flex items-center justify-center transition-colors">
                            <i className="ph-bold ph-x text-gray-400"></i>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* 1. Score Card */}
                        <div className="bg-uber-card border border-uber-border rounded-3xl p-6 relative overflow-hidden">
                            <div className="flex justify-between items-center relative z-10">
                                <div className="max-w-[60%]">
                                    <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                                        {scanResult.category}
                                    </span>
                                    <h3 className="text-xl font-bold text-white mb-1 leading-tight">{scanResult.title}</h3>
                                    <p className="text-xs text-gray-400 line-clamp-2">{scanResult.subtitle}</p>
                                </div>
                                
                                {/* Score Ring */}
                                <div className="relative w-20 h-20 flex items-center justify-center">
                                    <svg className="w-full h-full score-circle" viewBox="0 0 36 36">
                                        <path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                                        <path 
                                            className="transition-all duration-1000 ease-out" 
                                            strokeDasharray={`${(scanResult.score_final) * 10}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                            fill="none" 
                                            stroke={getScoreColor(scanResult.score_final)} 
                                            strokeWidth="3" 
                                            strokeLinecap="round" 
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-2xl font-bold text-white leading-none">{scanResult.score_final}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bars */}
                            <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-white/5">
                                {[
                                    { l: 'Safety', v: scanResult.scores?.safety, c: 'bg-blue-500' },
                                    { l: 'Purity', v: scanResult.scores?.purity, c: 'bg-green-500' },
                                    { l: 'Efficacy', v: scanResult.scores?.efficacy, c: 'bg-purple-500' }
                                ].map((stat) => (
                                    <div key={stat.l} className="text-center">
                                        <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{stat.l}</div>
                                        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                            <div className={`h-full ${stat.c} transition-all duration-1000`} style={{ width: `${stat.v}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. Verdict */}
                        <div className="bg-uber-card border border-uber-border rounded-xl p-4 flex gap-3">
                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center 
                                ${scanResult.verdict_type === 'safe' ? 'bg-green-900/30' : scanResult.verdict_type === 'danger' ? 'bg-red-900/30' : 'bg-yellow-900/30'}`}>
                                <i className={`text-xl ph-fill 
                                    ${scanResult.verdict_type === 'safe' ? 'ph-check-circle text-green-500' : scanResult.verdict_type === 'danger' ? 'ph-warning-octagon text-red-500' : 'ph-warning text-yellow-500'}`}>
                                </i>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Verdict</h4>
                                <p className="text-xs text-gray-400 leading-relaxed">{scanResult.verdict_text}</p>
                            </div>
                        </div>

                        {/* 3. Scientific Context */}
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">Scientific Context</h4>
                            <div className="text-sm text-gray-300 leading-relaxed bg-uber-card/50 p-4 rounded-xl border border-uber-border markdown-body">
                                <ReactMarkdown>{scanResult.scientific_context}</ReactMarkdown>
                            </div>
                        </div>

                        {/* 4. Components */}
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">Key Components</h4>
                            <div className="space-y-2">
                                {scanResult.components?.map((comp, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-uber-card border border-uber-border">
                                        <i className={`ph-bold mt-0.5 
                                            ${comp.status === 'safe' ? 'ph-check text-green-500' : comp.status === 'danger' ? 'ph-skull text-red-500' : 'ph-warning text-yellow-500'}`}>
                                        </i>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">{comp.name}</div>
                                            <div className="text-xs text-gray-500 leading-snug">{comp.reason}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Legal */}
                        <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                            <p className="text-[10px] text-gray-600 leading-relaxed text-justify">
                                <strong className="text-gray-500">DISCLAIMER:</strong> This analysis is for informational purposes only. The Parakh Trust Score is based on algorithmic analysis of public regulatory data. Always consult a licensed expert.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
};

export default App;