import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { User, Settings, History, Globe, LogOut, ChevronLeft, Loader2, Save } from 'lucide-react';

interface ProfileProps {
  token: string;
  onClose: () => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ token, onClose, onLogout }) => {
  const [profile, setProfile] = useState<any>(null);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, interactionsRes] = await Promise.all([
          fetch('/api/profile', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/interactions', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        setProfile(await profileRes.json());
        setInteractions(await interactionsRes.json());
      } catch (error) {
        console.error('Failed to fetch profile data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleUpdateProfile = async (updates: any) => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      setProfile({ ...profile, ...updates });
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-black/10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onClose} className="flex items-center gap-2 text-black/20 hover:text-black transition-colors group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Back</span>
          </button>
          <div className="text-center">
            <h1 className="serif text-3xl font-bold tracking-tight">Profile</h1>
            <p className="text-black/30 uppercase tracking-[0.2em] text-[9px] font-extrabold">{profile.name}</p>
          </div>
          <button onClick={onLogout} className="text-rose-500 hover:text-rose-600 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <div className="flex gap-4 mb-8 border-b border-black/[0.03]">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative ${
              activeTab === 'settings' ? 'text-black' : 'text-black/20'
            }`}
          >
            Settings
            {activeTab === 'settings' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-[10px] uppercase tracking-[0.1em] font-bold transition-all relative ${
              activeTab === 'history' ? 'text-black' : 'text-black/20'
            }`}
          >
            History
            {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />}
          </button>
        </div>

        {activeTab === 'settings' ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.1em] font-extrabold text-black/30 mb-3">Language</h3>
              <div className="grid grid-cols-2 gap-2">
                {['en', 'es', 'fr', 'de', 'ja'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleUpdateProfile({ language: lang })}
                    className={`p-3 rounded-lg border transition-all text-xs font-medium ${
                      profile.language === lang ? 'bg-black text-white border-black' : 'bg-black/[0.01] border-black/[0.03] hover:border-black/10'
                    }`}
                  >
                    {lang === 'en' && 'English'}
                    {lang === 'es' && 'Español'}
                    {lang === 'fr' && 'Français'}
                    {lang === 'de' && 'Deutsch'}
                    {lang === 'ja' && '日本語'}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.1em] font-extrabold text-black/30 mb-3">Bio</h3>
              <textarea
                placeholder="Personalize your experience..."
                value={profile.custom_training ? JSON.parse(profile.custom_training).bio : ''}
                onChange={(e) => handleUpdateProfile({ custom_training: JSON.stringify({ bio: e.target.value }) })}
                className="w-full p-3 rounded-lg border border-black/[0.05] bg-black/[0.01] focus:bg-white focus:border-black/10 transition-all outline-none text-xs min-h-[100px]"
              />
            </section>
          </div>
        ) : (
          <div className="space-y-2">
            {interactions.length === 0 ? (
              <p className="text-center py-8 text-black/20 text-[10px] uppercase tracking-widest font-bold">No history</p>
            ) : (
              interactions.map((interaction) => (
                <div key={interaction.id} className="p-3 rounded-lg border border-black/[0.05] bg-black/[0.01]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] uppercase tracking-widest font-extrabold text-black/40">{interaction.agent_id}</span>
                    <span className="text-[8px] text-black/20">{new Date(interaction.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-black/60 italic mb-1.5 line-clamp-2">"{interaction.transcript}"</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                      interaction.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-600' :
                      interaction.sentiment === 'Negative' ? 'bg-rose-50 text-rose-600' :
                      'bg-black/5 text-black/40'
                    }`}>
                      {interaction.sentiment}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
