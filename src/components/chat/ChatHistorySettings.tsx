import React, { useState, useEffect } from 'react';
import { Trash2, MessageSquare, Calendar, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Session {
  id: string;
  title: string | null;
  summary: string | null;
  last_message_at: string | null;
  created_at: string | null;
  child_id: string | null;
}

interface ChatHistorySettingsProps {
  open: boolean;
  onClose: () => void;
}

export const ChatHistorySettings: React.FC<ChatHistorySettingsProps> = ({
  open,
  onClose,
}) => {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch chat sessions
  useEffect(() => {
    if (profile?.id && open) {
      fetchSessions();
    }
  }, [profile?.id, open]);

  const fetchSessions = async () => {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', profile.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionToDelete.id);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
      toast({
        title: 'Chat Session Deleted',
        description: 'The chat session has been permanently removed.'
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the chat session. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  const openDeleteDialog = (session: Session) => {
    setSessionToDelete(session);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Conversation History Settings
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your chat sessions and conversation history
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <CardTitle>Chat History Management</CardTitle>
                </div>
                <p className="text-sm text-gray-600">
                  I save lightweight chat summaries, so I remember what matters and you don't have to start over. 
                  You can delete individual conversations here.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading your conversations...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No chat sessions found</p>
                    <p className="text-sm text-gray-400">Start a conversation to see your chat history here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <Card key={session.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 mb-2">
                              {session.title || 'Untitled Conversation'}
                            </h4>
                            {session.summary && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {session.summary}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Created: {formatDate(session.created_at)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                <span>Last activity: {formatDate(session.last_message_at)}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(session)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone.
              {sessionToDelete?.title && (
                <span className="block mt-2 font-medium">
                  "{sessionToDelete.title}"
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};