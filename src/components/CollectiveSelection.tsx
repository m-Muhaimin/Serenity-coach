import React from 'react';
import { motion } from 'motion/react';
import { 
  Heart, Shield, Sparkles, Brain, Zap, User, ArrowRight 
} from 'lucide-react';
import { AGENTS, Agent } from '../agents';

interface CollectiveSelectionProps {
  onSelect: (agent: Agent) => void;
}

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

export const CollectiveSelection: React.FC<CollectiveSelectionProps> = ({ onSelect }) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-serenity-bg">
      <div className="absolute inset-0 atmosphere z-0" />
      
      <main className="relative z-10 w-full max-w-5xl px-6 py-12 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block px-4 py-1 rounded-full border border-serenity-olive/20 text-[10px] uppercase tracking-[0.3em] font-bold text-serenity-olive/40 mb-6"
          >
            Serenity Collective
          </motion.div>
          <h1 className="serif text-7xl font-light mb-4 tracking-tight">The Collective</h1>
          <p className="text-serenity-olive/60 uppercase tracking-[0.3em] text-xs font-bold">Choose your guide for today</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
          {AGENTS.map((agent, index) => (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onSelect(agent)}
              className="group relative flex flex-col items-center p-10 rounded-3xl glass-card hover:bg-white transition-all duration-700 text-left overflow-hidden"
            >
              {/* Animated background glow on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.02] transition-opacity duration-700 pointer-events-none bg-serenity-ink"
              />
              
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-105 transition-transform duration-700 border border-serenity-ink/5 bg-white"
              >
                {getIcon(agent.icon, "text-serenity-ink w-10 h-10")}
              </div>
              
              <h3 className="serif text-3xl font-medium mb-2">{agent.name}</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-6 opacity-40">{agent.title}</p>
              
              <p className="text-sm text-serenity-ink/60 leading-relaxed mb-6">
                {agent.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {agent.traits.map((trait) => (
                  <span 
                    key={trait}
                    className="px-2 py-1 rounded-md text-[9px] uppercase tracking-wider font-bold border border-serenity-ink/5 bg-serenity-ink/[0.02] text-serenity-ink/40"
                  >
                    {trait}
                  </span>
                ))}
              </div>
              
              <div 
                className="mt-auto flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-500 text-serenity-ink" 
              >
                Begin Session <ArrowRight className="w-4 h-4" />
              </div>

              {/* Decorative corner accent */}
              <div 
                className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full opacity-0 group-hover:opacity-5 transition-opacity duration-700 bg-serenity-ink"
              />
            </motion.button>
          ))}
        </div>

        <motion.footer 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-24 text-center"
        >
          <div className="flex items-center justify-center gap-12 mb-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-serenity-olive/20" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-serenity-ink/20">Private</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-serenity-olive/20" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-serenity-ink/20">Secure</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-serenity-olive/20" />
              <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-serenity-ink/20">Empathetic</span>
            </div>
          </div>
          <p className="text-[10px] text-serenity-ink/30 uppercase tracking-[0.2em] font-bold max-w-md mx-auto leading-relaxed">
            A safe space for your thoughts. Choose the guide that resonates with your current state of mind.
          </p>
        </motion.footer>
      </main>
    </div>
  );
};
