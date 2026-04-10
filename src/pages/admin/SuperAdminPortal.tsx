import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  XCircle,
  Edit2,
  Shield,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  RefreshCw,
  Sparkles,
  LogOut,
  ChevronDown,
  Clock,
  Filter,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';

// ─── Super Admin Access Control ───────────────────────────────────
const SUPER_ADMIN_EMAILS = ['engineering@whisperoo.app'];

interface FeedbackEntry {
  id: string;
  user_query: string;
  ai_response: string;
  classification: string;
  status: string;
  created_at: string;
  tester_id: string | null;
}

type FilterTab = 'all' | 'user_feedback' | 'draft' | 'approved';

const CLASSIFICATION_LABELS: Record<string, string> = {
  no_answer: "Doesn't answer question",
  too_generic: 'Too generic',
  unsafe_concerning: 'Unsafe or concerning',
  tone_off: 'Tone felt off',
  slow_buggy: 'Slow or buggy',
  other: 'Something else',
  positive: 'Positive feedback',
  missed_escalation: 'Missed escalation',
  bad_medical_advice: 'Bad medical advice',
  inappropriate_tone: 'Inappropriate tone',
  false_positive: 'False positive',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  positive: 'bg-green-50 text-green-700 border-green-200',
  no_answer: 'bg-orange-50 text-orange-700 border-orange-200',
  too_generic: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  unsafe_concerning: 'bg-red-50 text-red-700 border-red-200',
  tone_off: 'bg-purple-50 text-purple-700 border-purple-200',
  slow_buggy: 'bg-gray-50 text-gray-700 border-gray-200',
  missed_escalation: 'bg-red-50 text-red-700 border-red-200',
  bad_medical_advice: 'bg-red-50 text-red-700 border-red-200',
  inappropriate_tone: 'bg-purple-50 text-purple-700 border-purple-200',
  false_positive: 'bg-blue-50 text-blue-700 border-blue-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  user_feedback: 'bg-blue-50 text-blue-700 border-blue-200',
  draft: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

const SuperAdminPortal: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [generatingEmbedding, setGeneratingEmbedding] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Auth guard
  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    if (SUPER_ADMIN_EMAILS.includes(user.email || '')) {
      setAuthorized(true);
    } else {
      toast({
        title: 'Access Denied',
        description: 'You do not have super admin privileges.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
    setCheckingAuth(false);
  }, [user, navigate]);

  useEffect(() => {
    if (authorized) fetchEntries();
  }, [authorized]);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('compliance_training')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  const filteredEntries = entries.filter((e) => {
    if (activeFilter === 'all') return true;
    return e.status === activeFilter;
  });

  const stats = {
    total: entries.length,
    userFeedback: entries.filter((e) => e.status === 'user_feedback').length,
    draft: entries.filter((e) => e.status === 'draft').length,
    approved: entries.filter((e) => e.status === 'approved').length,
    negative: entries.filter(
      (e) => e.classification !== 'positive' && e.status === 'user_feedback'
    ).length,
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === 'rejected') {
      const { error } = await supabase.from('compliance_training').delete().eq('id', id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Entry removed', description: 'Feedback has been discarded.' });
        setEntries(entries.filter((e) => e.id !== id));
      }
    } else {
      const { error } = await supabase
        .from('compliance_training')
        .update({ status })
        .eq('id', id);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({
          title: status === 'approved' ? 'Approved for Training' : 'Status Updated',
          description:
            status === 'approved'
              ? 'This feedback will be used to improve AI responses after embedding generation.'
              : `Status changed to ${status}.`,
        });
        setEntries(entries.map((e) => (e.id === id ? { ...e, status } : e)));
      }
    }
  };

  const startEditing = (entry: FeedbackEntry) => {
    setEditingId(entry.id);
    setEditContent(entry.ai_response);
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase
      .from('compliance_training')
      .update({ ai_response: editContent })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Response updated' });
      setEntries(entries.map((e) => (e.id === id ? { ...e, ai_response: editContent } : e)));
      setEditingId(null);
    }
  };

  const generateEmbedding = async (id: string) => {
    setGeneratingEmbedding(id);
    try {
      const { data, error } = await supabase.functions.invoke('generate_compliance_embedding', {
        body: { entry_id: id },
      });

      if (error) throw error;

      toast({
        title: 'Embedding Generated',
        description: `Entry is now active in AI training. ${data?.message || ''}`,
      });
    } catch (err: any) {
      toast({
        title: 'Embedding Failed',
        description: err.message || 'Could not generate embedding. Check edge function deployment.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingEmbedding(null);
    }
  };

  const generateAllEmbeddings = async () => {
    setGeneratingEmbedding('batch');
    try {
      const { data, error } = await supabase.functions.invoke('generate_compliance_embedding', {
        body: { batch_all: true },
      });

      if (error) throw error;

      toast({
        title: 'Batch Embedding Complete',
        description: data?.message || 'All approved entries now have embeddings.',
      });
    } catch (err: any) {
      toast({
        title: 'Batch Failed',
        description: err.message || 'Could not generate embeddings.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingEmbedding(null);
    }
  };

  // Separate user feedback from AI response content
  const parseResponseContent = (content: string) => {
    const separator = '\n\n---\nUser feedback: ';
    const separatorIndex = content.indexOf(separator);
    if (separatorIndex === -1) return { aiResponse: content, userFeedback: null };
    return {
      aiResponse: content.substring(0, separatorIndex),
      userFeedback: content.substring(separatorIndex + separator.length),
    };
  };

  if (checkingAuth || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Super Admin</h1>
                <p className="text-xs text-gray-500">Whisperoo Internal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden sm:block">{user?.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  signOut();
                  navigate('/');
                }}
                className="text-gray-500 gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Total Entries
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 text-xs font-medium mb-1">
              <MessageSquare className="w-3.5 h-3.5" />
              User Feedback
            </div>
            <p className="text-2xl font-bold text-blue-700">{stats.userFeedback}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-yellow-100 shadow-sm">
            <div className="flex items-center gap-2 text-yellow-600 text-xs font-medium mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Needs Review
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.negative}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-green-100 shadow-sm">
            <div className="flex items-center gap-2 text-green-600 text-xs font-medium mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Training Ready
            </div>
            <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
          </div>
        </div>

        {/* Filter Tabs + Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
            {([
              { key: 'all', label: 'All', count: stats.total },
              { key: 'user_feedback', label: 'User Feedback', count: stats.userFeedback },
              { key: 'draft', label: 'Tester Drafts', count: stats.draft },
              { key: 'approved', label: 'Approved', count: stats.approved },
            ] as { key: FilterTab; label: string; count: number }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeFilter === tab.key
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 text-xs ${
                    activeFilter === tab.key ? 'text-white/70' : 'text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {stats.approved > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={generateAllEmbeddings}
                disabled={generatingEmbedding === 'batch'}
                className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${generatingEmbedding === 'batch' ? 'animate-spin' : ''}`} />
                {generatingEmbedding === 'batch' ? 'Processing...' : 'Generate All Embeddings'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEntries}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Entries List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading feedback entries...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No entries found</p>
            <p className="text-gray-400 text-sm mt-1">
              {activeFilter === 'all'
                ? 'No feedback has been submitted yet.'
                : `No entries with status "${activeFilter.replace('_', ' ')}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEntries.map((entry) => {
              const { aiResponse, userFeedback } = parseResponseContent(entry.ai_response);
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
                >
                  {/* Entry Header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          entry.classification === 'positive'
                            ? 'bg-green-100'
                            : 'bg-red-50'
                        }`}
                      >
                        {entry.classification === 'positive' ? (
                          <ThumbsUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <ThumbsDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {entry.user_query === 'Positive feedback'
                            ? 'User liked this response'
                            : entry.user_query}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          CLASSIFICATION_COLORS[entry.classification] || CLASSIFICATION_COLORS.other
                        }`}
                      >
                        {CLASSIFICATION_LABELS[entry.classification] ||
                          entry.classification.replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          STATUS_COLORS[entry.status] || STATUS_COLORS.draft
                        }`}
                      >
                        {entry.status.replace(/_/g, ' ')}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                      {/* User Query */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" />
                          User Query
                        </h4>
                        <div className="text-sm text-gray-900 bg-white p-3 rounded-lg border border-gray-200">
                          {entry.user_query}
                        </div>
                      </div>

                      {/* AI Response */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          AI Response
                        </h4>
                        {editingId === entry.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="min-h-[150px] text-sm bg-white border-brand-primary/30 focus:border-brand-primary"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveEdit(entry.id)}>
                                Save Changes
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="group relative">
                            <div className="text-sm text-gray-900 bg-blue-50/50 p-3 rounded-lg border border-blue-100 whitespace-pre-wrap">
                              {aiResponse}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(entry);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* User Feedback Note (if present) */}
                      {userFeedback && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
                            <ThumbsDown className="w-3 h-3" />
                            User's Additional Feedback
                          </h4>
                          <div className="text-sm text-gray-800 bg-orange-50 p-3 rounded-lg border border-orange-200 italic">
                            "{userFeedback}"
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                        {entry.status !== 'approved' && (
                          <Button
                            size="sm"
                            className="bg-brand-primary hover:bg-brand-primary/90 text-white gap-1.5"
                            onClick={() => updateStatus(entry.id, 'approved')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approve for Training
                          </Button>
                        )}
                        {entry.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => generateEmbedding(entry.id)}
                            disabled={generatingEmbedding === entry.id}
                          >
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                generatingEmbedding === entry.id ? 'animate-spin' : ''
                              }`}
                            />
                            {generatingEmbedding === entry.id
                              ? 'Generating...'
                              : 'Generate Embedding'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 gap-1.5"
                          onClick={() => updateStatus(entry.id, 'rejected')}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject & Delete
                        </Button>
                        <div className="flex-1" />
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAdminPortal;
