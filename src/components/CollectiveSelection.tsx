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
    <div className="relative min-h-screen flex flex-col bg-serenity-bg pb-20">
      <main className="relative z-10 w-full max-w-lg mx-auto px-4 pt-12 flex flex-col">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h1 className="serif text-4xl font-bold tracking-tight">Collective</h1>
            <div className="w-8 h-8 rounded-lg bg-white border border-black/5 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-black/20" />
            </div>
          </div>
          <p className="text-black/40 uppercase tracking-[0.1em] text-[9px] font-extrabold">Choose your guide</p>
        </motion.div>

        <div className="flex flex-col gap-2 w-full">
          {AGENTS.map((agent, index) => (
            <motion.button
              key={agent.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelect(agent)}
              className="group relative flex items-center p-3 native-card active:scale-[0.98] transition-all duration-200 text-left"
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center border border-black/[0.05] bg-serenity-bg shadow-inner mr-3"
              >
                {getIcon(agent.icon, "text-black w-5 h-5")}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-sm">{agent.name}</h3>
                  {agent.recommended && (
                    <span className="px-1 py-0.5 rounded bg-black text-white text-[6px] uppercase tracking-widest font-black">
                      REC
                    </span>
                  )}
                </div>
                <p className="text-[9px] text-black/40 font-medium line-clamp-1">{agent.description}</p>
              </div>

              <div className="w-6 h-6 rounded-lg bg-black/[0.02] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                <ArrowRight className="w-3 h-3" />
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 rounded-lg bg-black/[0.02] border border-black/[0.03] text-center"
        >
          <p className="text-[9px] text-black/30 uppercase tracking-[0.1em] font-bold leading-relaxed">
            A safe space for your thoughts.
          </p>
        </motion.div>
      </main>
    </div>
  );
};
