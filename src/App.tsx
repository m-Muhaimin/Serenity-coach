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
import { CollectiveSelection } from './components/CollectiveSelection';

export default function App() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ringing' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [sentiment, setSentiment] = useState<{ label: string, score?: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [volume, setVolume] = useState(0);
  const [showCrisisResources, setShowCrisisResources] = useState(false);

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const sessionRef = useRef<any>(null);
  const volumeIntervalRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isConnected && status !== 'ringing') {
      durationIntervalRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (!isConnected) setCallDuration(0);
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [isConnected, status]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isConnected) {
      volumeIntervalRef.current = window.setInterval(() => {
        if (status === 'listening' && audioProcessorRef.current) {
          setVolume(audioProcessorRef.current.getVolume());
        } else if (status === 'speaking' && audioPlayerRef.current) {
          setVolume(audioPlayerRef.current.getVolume());
        } else {
          setVolume(0);
        }
      }, 50);
    } else {
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
      setVolume(0);
    }
    return () => {
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    };
  }, [isConnected, status]);

  const startSession = async () => {
    if (!selectedAgent) return;
    setStatus('ringing');
    
    // Simulate ringing for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the sentiment of the following user speech in a supportive conversation with an AI guide. 
        Provide a sentiment label: Positive, Negative, or Neutral.
        Speech: "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              label: {
                type: "STRING",
                description: "The sentiment label: Positive, Negative, or Neutral",
              }
            },
            required: ["label"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.label) {
        setSentiment({ label: result.label });
      }
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
    return <CollectiveSelection onSelect={setSelectedAgent} />;
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
          className="absolute top-0 left-6 flex items-center gap-2 text-serenity-ink/40 hover:text-serenity-ink transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[9px] uppercase tracking-widest font-bold">Collective</span>
        </motion.button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <div 
              className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-sm border border-serenity-ink/5 bg-white"
            >
              {getIcon(selectedAgent.icon, "text-serenity-ink w-10 h-10")}
            </div>
          </div>
          <h1 className="serif text-5xl font-light mb-2 tracking-tight">{selectedAgent.name}</h1>
          <div className="flex flex-col items-center gap-1">
            <p className="text-serenity-ink/40 uppercase tracking-[0.2em] text-[10px] font-bold">{selectedAgent.title}</p>
            {isConnected && (
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mono text-[10px] text-serenity-ink/60 font-medium"
              >
                {formatDuration(callDuration)}
              </motion.span>
            )}
          </div>
        </motion.div>

        <div className={`w-full glass-card rounded-3xl p-12 flex flex-col items-center relative overflow-hidden transition-all duration-1000 ${
          sentiment?.label === 'Positive' ? 'border-emerald-200/50' :
          sentiment?.label === 'Negative' ? 'border-rose-200/50' :
          sentiment?.label === 'Neutral' ? 'border-amber-200/50' :
          ''
        }`}>
          {/* Visualizer/Status Indicator */}
          <div className="relative w-48 h-48 mb-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {status === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: [0.98, 1.02, 0.98],
                    opacity: [0.3, 0.5, 0.3]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 4, 
                    ease: "easeInOut" 
                  }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute inset-0 rounded-2xl border border-serenity-ink/10 flex items-center justify-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Sparkles className="text-serenity-ink/20 w-10 h-10" />
                    <span className="text-[8px] uppercase tracking-[0.3em] text-serenity-ink/30 font-bold">Ready</span>
                  </div>
                </motion.div>
              )}

              {status === 'ringing' && (
                <motion.div
                  key="ringing"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-16 h-16 rounded-full bg-serenity-ink/5 flex items-center justify-center"
                  >
                    <PhoneOff className="w-6 h-6 text-serenity-ink/40 rotate-[135deg]" />
                  </motion.div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-serenity-ink/40 font-bold animate-pulse">Ringing...</span>
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
                  {/* Breathing background layer */}
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.05, 1],
                      opacity: [0.03, 0.08, 0.03]
                    }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                    className="absolute -inset-4 rounded-3xl bg-serenity-ink"
                  />
                  
                  <motion.div 
                    animate={{ 
                      scale: status === 'speaking' ? [1, 1 + (volume / 120), 1] : 1,
                      opacity: status === 'speaking' ? [0.1, 0.2 + (volume / 250), 0.1] : 0.1
                    }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-3xl bg-serenity-ink"
                  />
                  <motion.div 
                    animate={{ 
                      scale: status === 'listening' ? [1, 1.02 + (volume / 200), 1] : 1,
                      opacity: status === 'listening' ? [0.05, 0.1 + (volume / 300), 0.05] : 0.05
                    }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    className="absolute -inset-2 rounded-3xl bg-serenity-ink"
                  />
                  {/* Dynamic volume bars */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                    {[...Array(7)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          height: status !== 'connecting' ? [12, 12 + (volume * (0.6 + Math.random())), 12] : 12
                        }}
                        transition={{ repeat: Infinity, duration: 0.4 + (i * 0.08) }}
                        className="w-1 rounded-full bg-serenity-ink/30"
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {status === 'connecting' ? (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="w-8 h-8 border-2 border-serenity-ink/10 border-t-serenity-ink rounded-full"
                      />
                    ) : status === 'speaking' ? (
                      <Volume2 className="w-8 h-8 text-serenity-ink/60" />
                    ) : (
                      <Mic className="w-8 h-8 text-serenity-ink/60" />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-center mb-12">
            <h2 className="serif text-2xl mb-2 font-medium">
              {status === 'idle' && "Ready to connect."}
              {status === 'ringing' && "Calling..."}
              {status === 'connecting' && "Establishing connection..."}
              {status === 'listening' && "Listening..."}
              {status === 'speaking' && `${selectedAgent.name} is speaking`}
            </h2>
            
            <AnimatePresence>
              {sentiment && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 mb-4"
                >
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${
                    sentiment.label === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    sentiment.label === 'Negative' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                    'bg-serenity-muted text-serenity-ink/60 border-serenity-ink/5'
                  }`}>
                    {sentiment.label === 'Positive' && <Smile className="w-3 h-3" />}
                    {sentiment.label === 'Negative' && <Frown className="w-3 h-3" />}
                    {sentiment.label === 'Neutral' && <Meh className="w-3 h-3" />}
                    {sentiment.label}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-serenity-ink/40 text-xs max-w-xs mx-auto leading-relaxed">
              {status === 'idle' && "Tap the button to begin. Your conversation is secure and private."}
              {status === 'listening' && (transcript || "Speak freely, I'm here for you.")}
              {status === 'speaking' && "Listening to your guide's response."}
            </p>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-6">
              {!isConnected && status !== 'ringing' && status !== 'connecting' ? (
                <button
                  onClick={startSession}
                  className="bg-serenity-ink text-white px-12 py-4 rounded-2xl font-medium shadow-md hover:bg-serenity-ink/90 transition-all active:scale-95 flex items-center gap-3"
                >
                  <Mic className="w-5 h-5" />
                  <span className="uppercase tracking-widest text-xs font-bold">Start Call</span>
                </button>
              ) : (
                <div className="flex gap-4">
                  <button
                    onClick={stopSession}
                    className="bg-rose-600 text-white px-12 py-4 rounded-2xl font-medium shadow-md hover:bg-rose-700 transition-all active:scale-95 flex items-center gap-3"
                  >
                    <PhoneOff className="w-5 h-5" />
                    <span className="uppercase tracking-widest text-xs font-bold">End Call</span>
                  </button>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowCrisisResources(true)}
              className="text-[9px] uppercase tracking-[0.2em] font-bold text-serenity-ink/20 hover:text-serenity-ink/40 transition-colors"
            >
              Emergency Resources
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showCrisisResources && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-serenity-ink/20 backdrop-blur-sm"
              onClick={() => setShowCrisisResources(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="serif text-3xl mb-4">Crisis Resources</h3>
                <p className="text-serenity-ink/60 text-sm mb-6 leading-relaxed">
                  If you are in immediate danger or experiencing a life-threatening emergency, please call emergency services (911 in the US) or go to the nearest emergency room.
                </p>
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-serenity-bg border border-serenity-ink/5">
                    <p className="font-bold text-xs uppercase tracking-widest mb-1">988 Suicide & Crisis Lifeline</p>
                    <p className="text-sm text-serenity-ink/60">Call or text 988 (Available 24/7 in English and Spanish)</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-serenity-bg border border-serenity-ink/5">
                    <p className="font-bold text-xs uppercase tracking-widest mb-1">Crisis Text Line</p>
                    <p className="text-sm text-serenity-ink/60">Text HOME to 741741</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCrisisResources(false)}
                  className="w-full mt-8 py-4 rounded-full bg-serenity-ink text-white font-bold uppercase tracking-widest text-xs"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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

