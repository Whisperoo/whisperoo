import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Chat from '../Chat';

interface ComplianceLog {
  id: string;
  user_query: string;
  ai_response: string;
  classification: string;
  status: string;
  created_at: string;
}

const CompliancePortal: React.FC = () => {
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('compliance_training')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Error fetching logs', description: error.message, variant: 'destructive' });
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    if (status === 'rejected') {
      const { error } = await supabase
        .from('compliance_training')
        .delete()
        .eq('id', id);
        
      if (error) {
        toast({ title: 'Rejection failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Feedback rejected', description: `Entry permanently removed from the queue.` });
        setLogs(logs.filter(log => log.id !== id));
      }
    } else {
      const { error } = await supabase
        .from('compliance_training')
        .update({ status })
        .eq('id', id);
        
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Status updated', description: `Entry approved for training.` });
        setLogs(logs.map(log => log.id === id ? { ...log, status } : log));
      }
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-primary mb-2">AI Compliance Training Portal</h1>
        <p className="text-gray-600">Review flagged AI responses and approve them for self-learning RAG injection. Use the chat window to test edge cases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Local Test Chat Box */}
        <div className="flex flex-col h-full">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-brand-dark">Test Environment</h2>
            <p className="text-sm text-gray-500">Interact with the AI to trigger potential issues and flag them.</p>
          </div>
          <Chat isComplianceMode={true} isEmbedded={true} />
        </div>

        {/* Review Log Panel */}
        <div className="flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-brand-dark">Review Queue</h2>
            <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-2 pb-12">
          {logs.map((log) => (
            <div key={log.id} className="bg-white rounded-xl shadow-card p-6 border border-brand-primary/10 hover:border-brand-primary/30 hover:shadow-elevated transition-all duration-200">
              <div className="flex justify-between items-start mb-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100 uppercase tracking-wide">
                  {log.classification.replace(/_/g, ' ')}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  log.status === 'approved' ? 'bg-green-50 text-green-600 border-green-100' :
                  log.status === 'rejected' ? 'bg-gray-50 text-gray-600 border-gray-200' :
                  'bg-yellow-50 text-yellow-600 border-yellow-100'
                } uppercase tracking-wide`}>
                  Status: {log.status}
                </span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">User Query</h3>
                  <div className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">{log.user_query}</div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">AI Response</h3>
                  <div className="text-sm text-gray-900 bg-brand-primary/5 p-4 rounded-lg border border-brand-primary/10 shadow-sm whitespace-pre-wrap">{log.ai_response}</div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <Button
                  size="sm"
                  variant={log.status === 'approved' ? 'default' : 'outline'}
                  className={`font-medium ${log.status === 'approved' ? 'bg-brand-primary hover:bg-brand-primary/90 text-white shadow-sm' : 'text-brand-primary border-brand-primary/20 hover:bg-brand-primary/5'}`}
                  onClick={() => updateStatus(log.id, 'approved')}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve for Training
                </Button>
                <Button
                  size="sm"
                  variant={log.status === 'rejected' ? 'default' : 'outline'}
                  className={`font-medium ${log.status === 'rejected' ? 'bg-gray-600 hover:bg-gray-700 text-white shadow-sm' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                  onClick={() => updateStatus(log.id, 'rejected')}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-center text-gray-500 py-12">No training feedback submitted yet.</p>
          )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompliancePortal;
