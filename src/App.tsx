/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { 
  Mic, MicOff, PhoneOff, Heart, Sparkles, MessageSquare, 
  Volume2, Smile, Frown, Meh, Shield, Brain, Zap, ChevronLeft, 
  User as UserIcon, ArrowRight, ShoppingBag, Globe, Settings as SettingsIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AudioProcessor, AudioPlayer } from './audioUtils';
import { AGENTS, Agent } from './agents';
import { CollectiveSelection } from './components/CollectiveSelection';
import { Auth } from './components/Auth';
import { Profile } from './components/Profile';
import { Marketplace } from './components/Marketplace';

export default function App() {
  // --- Auth State ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('suprvoice_token'));
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userSkills, setUserSkills] = useState<any[]>([]);
  const [view, setView] = useState<'selection' | 'call' | 'profile' | 'marketplace'>('selection');

  // --- Call State ---
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ringing' | 'connecting' | 'listening' | 'speaking'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [sentiment, setSentiment] = useState<{ label: string, score?: number } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [volume, setVolume] = useState(0);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [showCrisisResources, setShowCrisisResources] = useState(false);

  // --- Refs ---
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const sessionRef = useRef<any>(null);
  const volumeIntervalRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  // --- Auth Handlers ---
  const handleAuthSuccess = (newToken: string, newUser: any) => {
    localStorage.setItem('suprvoice_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('suprvoice_token');
    setToken(null);
    setUser(null);
    setUserProfile(null);
    setUserSkills([]);
    setView('selection');
  };

  const fetchUserData = useCallback(() => {
    if (token) {
      Promise.all([
        fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/user/skills', { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      .then(async ([profileRes, skillsRes]) => {
        if (!profileRes.ok || !skillsRes.ok) throw new Error('Failed to fetch user data');
        const profileData = await profileRes.json();
        const skillsData = await skillsRes.json();
        setUserProfile(profileData);
        setUserSkills(skillsData);
      })
      .catch(() => handleLogout());
    }
  }, [token]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

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
      
      // Personalization Context
      const customBio = userProfile?.custom_training ? JSON.parse(userProfile.custom_training).bio : '';
      const language = userProfile?.language || 'en';
      const skillsContext = userSkills.length > 0 
        ? `INSTALLED SKILLS:\n${userSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}`
        : '';
      
      const systemInstruction = `
        ${selectedAgent.instruction}
        
        USER CONTEXT:
        - Name: ${userProfile?.name || 'User'}
        - Preferred Language: ${language}
        - Personal Bio: ${customBio}
        
        ${skillsContext}
        
        INSTRUCTIONS:
        1. Always start with a friendly and casual greeting.
        2. Respond in the user's preferred language (${language}) unless they speak in another language, in which case detect and adapt.
        3. If you detect the user is speaking a different language than before, prefix your next response with "[LANG:XX]" where XX is the ISO code (e.g., [LANG:ES] for Spanish).
        4. Use the provided Bio to personalize your responses and build rapport.
        5. Keep responses concise and natural for a voice conversation.
      `;

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedAgent.voice } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setIsConnected(true);
            setStatus('listening');
            startAudio();
            
            // Trigger initial greeting
            if (sessionRef.current) {
              sessionRef.current.sendRealtimeInput({
                text: "Hi, I'm here. Please start our session with a friendly and casual greeting based on your persona."
              });
            }
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
                  let text = part.text.trim();
                  
                  // Handle Language Detection Tag
                  const langMatch = text.match(/^\[LANG:(\w+)\]/i);
                  if (langMatch) {
                    setDetectedLanguage(langMatch[1].toUpperCase());
                    text = text.replace(/^\[LANG:\w+\]/i, '').trim();
                  }

                  if (status === 'listening' || !base64Audio) {
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
        
        // Save interaction to history
        if (token) {
          fetch('/api/interactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              agent_id: selectedAgent?.id,
              transcript: text,
              sentiment: result.label
            })
          });
        }
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
      default: return <UserIcon className={className} />;
    }
  };

  if (!token) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (view === 'profile') {
    return <Profile token={token} onClose={() => setView('selection')} onLogout={handleLogout} />;
  }

  if (view === 'marketplace') {
    return <Marketplace token={token} onClose={() => setView('selection')} onSkillInstalled={fetchUserData} />;
  }

  if (!selectedAgent) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-white">
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <button 
            onClick={() => setView('marketplace')}
            className="p-2 rounded-lg bg-black/[0.02] border border-black/[0.05] hover:bg-black/5 transition-all text-black/40 hover:text-black"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setView('profile')}
            className="p-2 rounded-lg bg-black/[0.02] border border-black/[0.05] hover:bg-black/5 transition-all text-black/40 hover:text-black"
          >
            <UserIcon className="w-4 h-4" />
          </button>
        </div>
        <CollectiveSelection onSelect={(agent) => {
          setSelectedAgent(agent);
          setView('call');
        }} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-white">
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex flex-col items-center min-h-screen justify-between">
        <div className="w-full flex flex-col items-center flex-1 justify-center">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => {
              stopSession();
              setSelectedAgent(null);
              setView('selection');
            }}
            className="absolute top-4 left-4 flex items-center gap-2 text-black/20 hover:text-black transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Back</span>
          </motion.button>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center mb-4">
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center border border-black/[0.05] bg-white shadow-sm"
              >
                {getIcon(selectedAgent.icon, "text-black w-6 h-6")}
              </div>
            </div>
            <h1 className="serif text-4xl font-bold mb-1 tracking-tight">{selectedAgent.name}</h1>
            <div className="flex flex-col items-center gap-1">
              <p className="text-black/30 uppercase tracking-[0.2em] text-[9px] font-extrabold">{selectedAgent.title}</p>
              <AnimatePresence>
                {detectedLanguage && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/[0.03] border border-black/[0.05] mt-2"
                  >
                    <Globe className="w-2.5 h-2.5 text-black/40" />
                    <span className="text-[8px] uppercase tracking-widest font-bold text-black/40">Detected: {detectedLanguage}</span>
                  </motion.div>
                )}
                {sentiment && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border mt-2 ${
                      sentiment.label === 'Positive' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                      sentiment.label === 'Negative' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                      'bg-black/[0.03] border-black/[0.05] text-black/40'
                    }`}
                  >
                    {sentiment.label === 'Positive' ? <Smile className="w-2.5 h-2.5" /> :
                     sentiment.label === 'Negative' ? <Frown className="w-2.5 h-2.5" /> :
                     <Meh className="w-2.5 h-2.5" />}
                    <span className="text-[8px] uppercase tracking-widest font-bold">Sentiment: {sentiment.label}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {isConnected && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mono text-[11px] text-black/50 font-medium tracking-wider"
                >
                  {formatDuration(callDuration)}
                </motion.span>
              )}
            </div>
          </motion.div>

          <div className="w-full flex flex-col items-center transition-all duration-1000">
            {/* Visualizer/Status Indicator */}
            <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.05, 1],
                      opacity: [0.2, 0.4, 0.2]
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 5, 
                      ease: "easeInOut" 
                    }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="absolute inset-0 rounded-full border border-black/[0.05] flex items-center justify-center"
                  >
                    <Sparkles className="text-black/5 w-10 h-10" />
                  </motion.div>
                )}

                {status === 'ringing' && (
                  <motion.div
                    key="ringing"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                  >
                    <motion.div 
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="w-20 h-20 rounded-full bg-black/[0.02] flex items-center justify-center border border-black/[0.03]"
                    >
                      <PhoneOff className="w-7 h-7 text-black/20 rotate-[135deg]" />
                    </motion.div>
                    <span className="text-[10px] uppercase tracking-[0.4em] text-black/30 font-bold animate-pulse">Calling</span>
                  </motion.div>
                )}
                
                {(status === 'listening' || status === 'speaking' || status === 'connecting') && (
                  <motion.div
                    key="active"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full h-full flex items-center justify-center"
                  >
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.01, 0.03, 0.01]
                      }}
                      transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                      className="absolute inset-0 rounded-full bg-black"
                    />
                    
                    <motion.div 
                      animate={{ 
                        scale: status === 'speaking' ? [1, 1 + (volume / 100), 1] : 1,
                        opacity: status === 'speaking' ? [0.03, 0.08 + (volume / 200), 0.03] : 0.03
                      }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="absolute inset-4 rounded-full bg-black"
                    />
                    
                    {/* Minimal Volume Bars */}
                    <div className="flex items-center justify-center gap-2">
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ 
                            height: status !== 'connecting' ? [16, 16 + (volume * (0.8 + Math.random())), 16] : 16,
                            opacity: status !== 'connecting' ? [0.1, 0.3, 0.1] : 0.1
                          }}
                          transition={{ repeat: Infinity, duration: 0.5 + (i * 0.1) }}
                          className="w-1 rounded-full bg-black"
                        />
                      ))}
                    </div>

                    <div className="absolute bottom-[-40px] flex flex-col items-center gap-2">
                      {status === 'connecting' ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="w-5 h-5 border border-black/10 border-t-black rounded-full"
                        />
                      ) : (
                        <span className="text-[9px] uppercase tracking-[0.3em] text-black/30 font-bold">
                          {status === 'listening' ? 'Listening' : 'Speaking'}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="text-center w-full max-w-xs">
              <AnimatePresence mode="wait">
                {transcript && (
                  <motion.p 
                    key={transcript}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-black/50 text-[13px] leading-relaxed italic font-light mb-8"
                  >
                    "{transcript}"
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex flex-col items-center gap-4">
                {!isConnected && status !== 'ringing' && status !== 'connecting' ? (
                  <button
                    onClick={startSession}
                    className="bg-black text-white w-full py-3 rounded-lg font-bold shadow-sm hover:bg-black/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    <span className="uppercase tracking-[0.1em] text-[10px]">Start Session</span>
                  </button>
                ) : (
                  <button
                    onClick={stopSession}
                    className="bg-black text-white w-full py-3 rounded-lg font-bold shadow-sm hover:bg-black/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span className="uppercase tracking-[0.1em] text-[10px]">End Session</span>
                  </button>
                )}
                
                <button 
                  onClick={() => setShowCrisisResources(true)}
                  className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-black/10 hover:text-black/30 transition-colors"
                >
                  Resources
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showCrisisResources && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowCrisisResources(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg p-6 max-w-md w-full shadow-sm"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="serif text-2xl mb-2">Crisis Resources</h3>
              <p className="text-black/60 text-xs mb-4 leading-relaxed">
                If you are in immediate danger or experiencing a life-threatening emergency, please call emergency services (911 in the US) or go to the nearest emergency room.
              </p>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-serenity-muted border border-black/5">
                  <p className="font-bold text-[10px] uppercase tracking-widest mb-0.5">988 Suicide & Crisis Lifeline</p>
                  <p className="text-xs text-black/60">Call or text 988 (Available 24/7)</p>
                </div>
                <div className="p-3 rounded-lg bg-serenity-muted border border-black/5">
                  <p className="font-bold text-[10px] uppercase tracking-widest mb-0.5">Crisis Text Line</p>
                  <p className="text-xs text-black/60">Text HOME to 741741</p>
                </div>
              </div>
              <button
                onClick={() => setShowCrisisResources(false)}
                className="w-full mt-6 py-3 rounded-lg bg-black text-white font-bold uppercase tracking-widest text-[10px]"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

