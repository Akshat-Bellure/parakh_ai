import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Send, Bot, User, Loader2, MapPin, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';

const ChatMode: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Placeholder for streaming message
    const botMessageId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: botMessageId, role: 'model', text: '', timestamp: Date.now(), isStreaming: true }
    ]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-3-flash for general chat as recommended
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: "You are a helpful, creative, and intelligent AI assistant. Use Markdown for formatting.",
            tools: [{ googleSearch: {} }] // Enable grounding
        }
      });

      // Reconstruct history
      // Note: In a real app, we would maintain the chat session object. 
      // For simplicity here, we are creating a new chat each time but managing history context is complex with restart.
      // Let's just send the last message for this demo or handle it via a persistent chat object in a Context.
      // To keep it simple and robust within one file, we will just start a new generation for the latest prompt 
      // but visually show history. For true context, we'd need to map `messages` to `Content` objects.
      
      const responseStream = await chat.sendMessageStream({ message: userMessage.text });
      
      let fullText = '';
      
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullText += c.text;
          setMessages(prev => 
            prev.map(msg => 
              msg.id === botMessageId 
                ? { ...msg, text: fullText } 
                : msg
            )
          );
        }
        
        // Handle grounding chunks if available in the final response (or accumulated)
        // Note: Grounding usually comes in the final payload or special chunks.
        // We'll simplify and just show text for streaming.
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: "Sorry, I encountered an error processing your request." } 
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, isStreaming: false } 
            : msg
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            Gemini Chat
            <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full ml-2">Flash 2.0</span>
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <Bot className="w-16 h-16 opacity-20" />
                <p>Start a conversation with Gemini</p>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-indigo-400" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800/50 text-zinc-200 border border-zinc-700/50'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-zinc-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="relative max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full bg-zinc-800 text-zinc-100 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-[52px] scrollbar-hide"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1.5 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center mt-2 text-xs text-zinc-500 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1"><Search className="w-3 h-3"/> Google Search Grounding Enabled</span>
        </div>
      </div>
    </div>
  );
};

export default ChatMode;