import React, { useState, useEffect } from 'react';
import { Trash2, MessageSquare, Calendar, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
interface Session {
  id: string;
  title: string | null;
  summary: string | null;
  last_message_at: string | null;
  created_at: string | null;
  child_id: string | null;
}
const SettingsPage: React.FC = () => {
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch chat sessions
  useEffect(() => {
    if (profile?.id) {
      fetchSessions();
    }
  }, [profile?.id]);
  const fetchSessions = async () => {
    if (!profile?.id) return;
    try {
      const {
        data,
        error
      } = await supabase.from('sessions').select('*').eq('user_id', profile.id).order('last_message_at', {
        ascending: false,
        nullsFirst: false
      });
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
      const {
        error
      } = await supabase.from('sessions').delete().eq('id', sessionToDelete.id);
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
  if (!profile) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">No Profile Found</h2>
          <p className="text-gray-600 mt-2">Please log in to view your settings.</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600 text-lg">Manage your account and chat preferences</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chat">Chat History</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            {/* Chat History Tab */}
            <TabsContent value="chat" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Chat History Management
                  </CardTitle>
                  <p className="text-sm text-gray-600">I save lightweight chat summaries, so I remember what matters and you don’t have to start over. You can delete individual conversations here. </p>
                </CardHeader>
                <CardContent>
                  {loading ? <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-gray-600 mt-2">Loading chat sessions...</p>
                    </div> : sessions.length === 0 ? <div className="text-center py-8">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No chat sessions found.</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Start a conversation with Whisperoo to see your chat history here.
                      </p>
                      <Button onClick={() => navigate('/chat')} className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                        Start Chatting
                      </Button>
                    </div> : <div className="space-y-3">
                      {sessions.map(session => <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900">
                                {session.title || 'Untitled Chat'}
                              </h4>
                              {session.child_id && <Badge variant="outline" className="text-xs">
                                  Child-specific
                                </Badge>}
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {session.summary || 'No summary available'}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                Created: {formatDate(session.created_at)}
                              </span>
                              <span className="flex items-center">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                Last activity: {formatDate(session.last_message_at)}
                              </span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => openDeleteDialog(session)} className="ml-4 text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>)}
                    </div>}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Info className="w-5 h-5 mr-2" />
                    Account Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                        {profile.first_name}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-md">
                        {profile.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-md capitalize">
                        {profile.role === 'other' && profile.custom_role ? profile.custom_role : profile.role || 'Parent'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Type
                      </label>
                      <Badge className="bg-indigo-100 text-indigo-700 capitalize">
                        {profile.account_type || 'user'}
                      </Badge>
                    </div>
                  </div>
                  
                  <Separator className="my-6" />
                  
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Profile Management</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button onClick={() => navigate('/profile')} className="bg-indigo-600 hover:bg-indigo-700">
                        Edit Profile
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/chat')}>
                        Go to Chat
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* About Tab */}
            <TabsContent value="about" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-xl">
                    <Info className="w-5 h-5 mr-2" />
                    About Whisperoo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-gray-700 space-y-3">
                    <p>
                      Whisperoo is your AI-powered parenting companion, designed to provide personalized 
                      support and guidance for your family journey.
                    </p>
                    <p>
                      Our AI assistant understands your family context and provides tailored advice 
                      based on your children's ages, your parenting style, and your specific concerns.
                    </p>
                    
                    <Separator className="my-6" />
                    
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-900">Features</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>Personalized parenting advice</li>
                        <li>Child-specific guidance based on age and development</li>
                        <li>Expert-created resources and content</li>
                        <li>Secure and private conversations</li>
                        <li>24/7 availability</li>
                      </ul>
                    </div>
                    
                    <Separator className="my-6" />
                    
                    <div className="text-sm text-gray-600">
                      <p>
                        <strong>Privacy:</strong> Your conversations with Whisperoo are private and secure. 
                        We never share your personal information or family details with third parties.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat session? This action cannot be undone.
              <br /><br />
              <strong>Session:</strong> {sessionToDelete?.title || 'Untitled Chat'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Deleting...' : 'Delete Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default SettingsPage;