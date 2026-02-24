/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { 
  Mic, MicOff, PhoneOff, Heart, Sparkles, MessageSquare, 
  Volume2, Smile, Frown, Meh, Shield, Brain, Zap, ChevronLeft, 
  User, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioProcessor, AudioPlayer } from './audioUtils';
import { AGENTS, Agent } from './agents';

export default function App() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState<string>("");
  const [sentiment, setSentiment] = useState<{ label: string, score?: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const sessionRef = useRef<any>(null);

  const startSession = async () => {
    if (!selectedAgent) return;
    setStatus('connecting');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedAgent.voice } },
          },
          systemInstruction: selectedAgent.instruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setIsConnected(true);
            setStatus('listening');
            startAudio();
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setStatus('speaking');
              audioPlayerRef.current?.playChunk(base64Audio);
            }

            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) {
                  if (status === 'listening' || !base64Audio) {
                    const text = part.text.trim();
                    if (text) {
                      setTranscript(text);
                      analyzeSentiment(text);
                    }
                  }
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioPlayerRef.current?.stop();
              setStatus('listening');
            }

            if (message.serverContent?.turnComplete) {
              setStatus('listening');
            }
          },
          onclose: () => {
            console.log("Session closed");
            stopSession();
          },
          onerror: (err) => {
            console.error("Session error:", err);
            stopSession();
          }
        }
      });

      sessionRef.current = session;
    } catch (error) {
      console.error("Failed to start session:", error);
      setStatus('idle');
    }
  };

  const analyzeSentiment = async (text: string) => {
    if (!text || text.length < 5) return;
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error("Failed to fetch sentiment");
      
      const data = await response.json();
      setSentiment({ label: data.label });
    } catch (error) {
      console.error("Sentiment analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAudio = async () => {
    if (!audioProcessorRef.current) {
      audioProcessorRef.current = new AudioProcessor(16000);
    }
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioPlayer(24000);
    }

    await audioProcessorRef.current.start((base64Data) => {
      if (sessionRef.current) {
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      }
    });
    setIsRecording(true);
  };

  const stopSession = () => {
    audioProcessorRef.current?.stop();
    audioPlayerRef.current?.stop();
    sessionRef.current?.close();
    
    setIsConnected(false);
    setIsRecording(false);
    setStatus('idle');
    sessionRef.current = null;
  };

  const getIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'Heart': return <Heart className={className} />;
      case 'Shield': return <Shield className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Brain': return <Brain className={className} />;
      case 'Zap': return <Zap className={className} />;
      default: return <User className={className} />;
    }
  };

  if (!selectedAgent) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-serenity-bg">
        <div className="absolute inset-0 atmosphere z-0" />
        
        <main className="relative z-10 w-full max-w-4xl px-6 py-12 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="serif text-6xl font-light mb-4 tracking-tight">The Collective</h1>
            <p className="text-serenity-olive/60 uppercase tracking-[0.3em] text-xs font-bold">Choose your guide for today</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {AGENTS.map((agent, index) => (
              <motion.button
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedAgent(agent)}
                className="group relative flex flex-col items-center p-8 rounded-[32px] glass-card hover:bg-white/60 transition-all duration-500 text-left"
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500"
                  style={{ backgroundColor: agent.color }}
                >
                  {getIcon(agent.icon, "text-white w-8 h-8")}
                </div>
                <h3 className="serif text-2xl font-medium mb-1">{agent.name}</h3>
                <p className="text-[10px] uppercase tracking-widest font-bold mb-4 opacity-40">{agent.title}</p>
                <p className="text-sm text-serenity-ink/60 leading-relaxed mb-6">
                  {agent.description}
                </p>
                <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: agent.color }}>
                  Select Guide <ArrowRight className="w-3 h-3" />
                </div>
              </motion.button>
            ))}
          </div>

          <footer className="mt-20 text-center">
            <p className="text-[10px] text-serenity-ink/30 uppercase tracking-[0.2em] font-bold">
              Secure • Private • Empathetic
            </p>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 atmosphere z-0" />
      
      <main className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => {
            stopSession();
            setSelectedAgent(null);
          }}
          className="absolute top-0 left-6 flex items-center gap-2 text-serenity-olive/60 hover:text-serenity-olive transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] uppercase tracking-widest font-bold">Back to Collective</span>
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: selectedAgent.color }}
            >
              {getIcon(selectedAgent.icon, "text-white w-8 h-8")}
            </div>
          </div>
          <h1 className="serif text-5xl font-light mb-2 tracking-tight">{selectedAgent.name}</h1>
          <p className="text-serenity-olive/60 uppercase tracking-widest text-xs font-semibold">{selectedAgent.title}</p>
        </motion.div>

        <div className="w-full glass-card rounded-[40px] p-12 flex flex-col items-center relative overflow-hidden">
          {/* Visualizer/Status Indicator */}
          <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute inset-0 rounded-full border border-serenity-olive/20 flex items-center justify-center"
                >
                  <Sparkles className="text-serenity-olive/30 w-12 h-12" />
                </motion.div>
              )}
              
              {(status === 'listening' || status === 'speaking' || status === 'connecting') && (
                <motion.div
                  key="active"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative w-full h-full"
                >
                  <motion.div 
                    animate={{ 
                      scale: status === 'speaking' ? [1, 1.1, 1] : 1,
                      opacity: status === 'speaking' ? [0.2, 0.4, 0.2] : 0.2
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: selectedAgent.color }}
                  />
                  <motion.div 
                    animate={{ 
                      scale: status === 'listening' ? [1, 1.05, 1] : 1,
                      opacity: status === 'listening' ? [0.1, 0.2, 0.1] : 0.1
                    }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -inset-4 rounded-full"
                    style={{ backgroundColor: selectedAgent.color }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {status === 'connecting' ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="w-8 h-8 border-2 border-t-transparent rounded-full"
                        style={{ borderColor: selectedAgent.color, borderTopColor: 'transparent' }}
                      />
                    ) : status === 'speaking' ? (
                      <Volume2 className="w-10 h-10" style={{ color: selectedAgent.color }} />
                    ) : (
                      <Mic className="w-10 h-10" style={{ color: selectedAgent.color }} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-center mb-12">
            <h2 className="serif text-2xl mb-2 italic">
              {status === 'idle' && "Ready to listen when you are."}
              {status === 'connecting' && "Connecting to your guide..."}
              {status === 'listening' && "I'm listening..."}
              {status === 'speaking' && `${selectedAgent.name} is speaking...`}
            </h2>
            
            <AnimatePresence>
              {sentiment && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 mb-4"
                >
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    sentiment.label === 'Positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    sentiment.label === 'Negative' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {sentiment.label === 'Positive' && <Smile className="w-3 h-3" />}
                    {sentiment.label === 'Negative' && <Frown className="w-3 h-3" />}
                    {sentiment.label === 'Neutral' && <Meh className="w-3 h-3" />}
                    {sentiment.label} Tone
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-serenity-ink/40 text-sm max-w-xs mx-auto">
              {status === 'idle' && "Click the button below to start your session. Your conversation is private and supportive."}
              {status === 'listening' && (transcript || "Feel free to share whatever is on your mind.")}
              {status === 'speaking' && `${selectedAgent.name} is responding to your thoughts.`}
            </p>
          </div>

          <div className="flex gap-4">
            {!isConnected ? (
              <button
                onClick={startSession}
                className="text-white px-10 py-4 rounded-full font-medium shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                style={{ backgroundColor: selectedAgent.color }}
              >
                <Mic className="w-5 h-5" />
                Start Session
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="bg-red-50 text-red-600 border border-red-100 px-10 py-4 rounded-full font-medium shadow-sm hover:bg-red-100 transition-all active:scale-95 flex items-center gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                End Session
              </button>
            )}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 flex flex-col items-center gap-6"
        >
          <div className="flex gap-8 text-serenity-olive/40">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs uppercase tracking-widest font-semibold">Private</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="text-red-400/40 w-4 h-4" />
              <span className="text-xs uppercase tracking-widest font-semibold">Empathetic</span>
            </div>
          </div>
          
          <p className="text-[10px] text-serenity-ink/30 text-center max-w-md">
            {selectedAgent.name} is an AI companion for emotional support. If you are in crisis, please contact emergency services or a crisis hotline immediately.
          </p>
        </motion.div>
      </main>

      {/* Footer Rail */}
      <footer className="absolute bottom-8 left-0 right-0 px-12 flex justify-between items-end pointer-events-none">
        <div className="serif italic text-serenity-ink/20 text-lg">
          A moment for yourself.
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-serenity-ink/20">Session Status</span>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-serenity-ink/10'}`} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-serenity-ink/20">
              {isConnected ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

