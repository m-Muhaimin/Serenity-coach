import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Zap, Heart, Plus, Check, Loader2, ChevronLeft, Search, Star, MessageSquare, X } from 'lucide-react';

interface Skill {
  id: number;
  name: string;
  description: string;
  developer: string;
  icon: string;
  category: string;
  avg_rating: number | null;
  review_count: number;
}

interface Review {
  id: number;
  user_name: string;
  rating: number;
  comment: string;
  timestamp: string;
}

interface MarketplaceProps {
  token: string;
  onClose: () => void;
  onSkillInstalled?: () => void;
}

export const Marketplace: React.FC<MarketplaceProps> = ({ token, onClose, onSkillInstalled }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [userSkills, setUserSkills] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const categories = ['Wellness', 'Productivity', 'Entertainment', 'General'];

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (category) query.append('category', category);

      const [skillsRes, userSkillsRes] = await Promise.all([
        fetch(`/api/marketplace/skills?${query.toString()}`),
        fetch('/api/user/skills', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const skillsData = await skillsRes.json();
      const userSkillsData = await userSkillsRes.json();

      setSkills(skillsData);
      setUserSkills(userSkillsData.map((s: any) => s.id));
    } catch (error) {
      console.error('Failed to fetch marketplace data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [token, category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSkills();
  };

  const fetchReviews = async (skillId: number) => {
    try {
      const res = await fetch(`/api/marketplace/skills/${skillId}/reviews`);
      const data = await res.json();
      setReviews(data);
    } catch (error) {
      console.error('Failed to fetch reviews', error);
    }
  };

  const handleInstall = async (skillId: number) => {
    setInstalling(skillId);
    try {
      const response = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skill_id: skillId })
      });

      if (response.ok) {
        setUserSkills([...userSkills, skillId]);
        onSkillInstalled?.();
      }
    } catch (error) {
      console.error('Failed to install skill', error);
    } finally {
      setInstalling(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSkill) return;
    setSubmittingReview(true);
    try {
      const response = await fetch(`/api/marketplace/skills/${selectedSkill.id}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating: newRating, comment: newComment })
      });

      if (response.ok) {
        setNewComment('');
        fetchReviews(selectedSkill.id);
        fetchSkills(); // Refresh average rating
      }
    } catch (error) {
      console.error('Failed to submit review', error);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles className="w-5 h-5" />;
      case 'Zap': return <Zap className="w-5 h-5" />;
      case 'Heart': return <Heart className="w-5 h-5" />;
      default: return <Sparkles className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col items-center mb-8">
          <div className="w-full flex items-center justify-between mb-6">
            <button onClick={onClose} className="flex items-center gap-2 text-black/20 hover:text-black transition-colors group">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Back</span>
            </button>
            <div className="text-center">
              <h1 className="serif text-3xl font-bold tracking-tight">Marketplace</h1>
              <p className="text-black/30 uppercase tracking-[0.2em] text-[9px] font-extrabold">Enhance SuprVoice</p>
            </div>
            <div className="w-10" />
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-xl relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/20" />
              <input
                type="text"
                placeholder="Search skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-black/[0.05] bg-black/[0.01] focus:bg-white focus:border-black/10 transition-all outline-none text-xs"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-black/[0.05] bg-black/[0.01] focus:bg-white focus:border-black/10 transition-all outline-none text-xs appearance-none cursor-pointer"
            >
              <option value="">All</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </form>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-black/10" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {skills.map((skill) => (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg border border-black/[0.05] bg-black/[0.01] flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-black/[0.05] flex items-center justify-center shadow-sm">
                    {getIcon(skill.icon)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-xs">{skill.name}</h3>
                      <span className="text-[7px] uppercase tracking-widest font-extrabold text-black/20">by {skill.developer}</span>
                    </div>
                    <p className="text-[10px] text-black/50 mb-1.5 leading-relaxed line-clamp-2">{skill.description}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        <Star className={`w-2.5 h-2.5 ${skill.avg_rating ? 'text-amber-400 fill-amber-400' : 'text-black/10'}`} />
                        <span className="text-[9px] font-bold text-black/40">{skill.avg_rating ? skill.avg_rating.toFixed(1) : '-'}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setSelectedSkill(skill);
                          fetchReviews(skill.id);
                        }}
                        className="flex items-center gap-1 text-black/20 hover:text-black transition-colors"
                      >
                        <MessageSquare className="w-2.5 h-2.5" />
                        <span className="text-[9px] font-bold">{skill.review_count}</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => !userSkills.includes(skill.id) && handleInstall(skill.id)}
                  disabled={userSkills.includes(skill.id) || installing === skill.id}
                  className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all ${
                    userSkills.includes(skill.id) 
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                      : 'bg-black text-white hover:bg-black/90'
                  }`}
                >
                  {installing === skill.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : (
                    userSkills.includes(skill.id) ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />
                  )}
                  {userSkills.includes(skill.id) ? 'Installed' : 'Install'}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {selectedSkill && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
              onClick={() => setSelectedSkill(null)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-lg p-6 max-w-lg w-full shadow-sm max-h-[80vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="serif text-2xl">{selectedSkill.name} Reviews</h3>
                  <button onClick={() => setSelectedSkill(null)} className="text-black/20 hover:text-black">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitReview} className="mb-8 p-4 rounded-lg bg-black/[0.01] border border-black/[0.03]">
                  <h4 className="text-[9px] uppercase tracking-[0.1em] font-extrabold text-black/30 mb-3">Write a review</h4>
                  <div className="flex items-center gap-1.5 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        className="transition-transform active:scale-90"
                      >
                        <Star className={`w-4 h-4 ${newRating >= star ? 'text-amber-400 fill-amber-400' : 'text-black/10'}`} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Experience..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                    className="w-full p-3 rounded-lg border border-black/[0.05] bg-white focus:border-black/10 transition-all outline-none text-xs min-h-[80px] mb-3"
                  />
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full bg-black text-white py-2.5 rounded-lg font-bold uppercase tracking-widest text-[9px] disabled:opacity-50"
                  >
                    {submittingReview ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Submit'}
                  </button>
                </form>

                <div className="space-y-4">
                  {reviews.length === 0 ? (
                    <p className="text-center text-black/20 text-[10px] uppercase tracking-widest font-bold py-4">No reviews</p>
                  ) : (
                    reviews.map(review => (
                      <div key={review.id} className="border-b border-black/[0.03] pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{review.user_name}</span>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-2 h-2 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-black/10'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-[11px] text-black/60 leading-relaxed">{review.comment}</p>
                        <span className="text-[7px] text-black/20 mt-1 block">{new Date(review.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
