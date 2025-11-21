import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Send, MessageSquare, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import MessageBubble from '@/components/chat/MessageBubble';
import ChildSwitcher from '@/components/chat/ChildSwitcher';
import { ChatHistorySettings } from '@/components/chat/ChatHistorySettings';

// Supabase client is now imported from lib/supabase

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: Record<string, unknown>;
}
interface Child {
  id: string;
  first_name: string;
  birth_date: string | null;
  age: string | null;
  is_expecting: boolean;
  expected_name?: string;
}
const Chat: React.FC = () => {
  const {
    profile,
    user
  } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showHistorySettings, setShowHistorySettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  };
  const generateSessionSummary = async (sessionId: string) => {
    if (!sessionId) return;
    setIsGeneratingSummary(true);
    try {
      const {
        error
      } = await supabase.functions.invoke('fn_update_session_summary', {
        body: {
          session_id: sessionId
        }
      });
      if (error) {
        console.error('Error generating session summary:', error);
        // Don't throw - we don't want to block the user flow
      } else {
        console.log('Session summary generated successfully');
      }
    } catch (error) {
      console.error('Failed to generate session summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    if (user) {
      loadChildren();
      loadActiveSession();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription for new messages
  useEffect(() => {
    if (!currentSessionId) return;
    const channel = supabase.channel(`session-${currentSessionId}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `session_id=eq.${currentSessionId}`
    }, payload => {
      const newMessage = payload.new as Message;
      // Only add if it's not already in our messages (to avoid duplicates)
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSessionId]);
  const loadChildren = async () => {
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from('kids').select('*').eq('parent_id', user.id).order('created_at', {
      ascending: true
    });
    if (error) {
      console.error('Error loading children:', error);
      return;
    }
    setChildren(data || []);
  };
  const loadActiveSession = async () => {
    if (!user) return;
    const {
      data: sessions,
      error
    } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('is_active', true).order('last_message_at', {
      ascending: false
    }).limit(1);
    if (error) {
      console.error('Error loading active session:', error);
      return;
    }
    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      setCurrentSessionId(session.id);

      // Set selected child if session has child context
      if (session.child_id) {
        const child = children.find(c => c.id === session.child_id);
        if (child) setSelectedChild(child);
      }
      await loadMessages(session.id);
    }
  };
  const loadMessages = async (sessionId: string) => {
    const {
      data,
      error
    } = await supabase.from('messages').select('*').eq('session_id', sessionId).order('created_at', {
      ascending: true
    });
    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    setMessages(data || []);
    setMessageCount(data?.length || 0);
  };
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !user) return;
    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: Message = {
      id: 'temp-' + Date.now(),
      content: userMessage,
      role: 'user',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('chat_ai_rag_fixed', {
        body: {
          message: userMessage,
          sessionId: currentSessionId,
          childId: selectedChild?.id
        }
      });
      if (error) throw error;

      // Update session ID if this was a new session
      const sessionId = data.sessionId || currentSessionId;
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }

      // Add AI response to messages
      const aiMessage: Message = {
        id: 'ai-' + Date.now(),
        content: data.response,
        role: 'assistant',
        created_at: new Date().toISOString(),
        metadata: {
          expert_suggestions: data.expertSuggestions || []
        }
      };
      setMessages(prev => {
        // Remove temp message and add both real user message and AI response
        const withoutTemp = prev.filter(m => !m.id.startsWith('temp-'));
        const newMessages = [...withoutTemp, {
          ...tempUserMessage,
          id: 'user-' + Date.now()
        }, aiMessage];

        // Update message count and trigger summary if needed
        const newCount = newMessages.length;
        setMessageCount(newCount);

        // Generate summary every 10 messages (in background)
        if (sessionId && newCount > 0 && newCount % 10 === 0) {
          generateSessionSummary(sessionId).catch(err => console.error('Background summary generation failed:', err));
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));

      // Show error message
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again.",
        role: 'assistant',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  const startNewSession = async () => {
    // Generate summary for current session before starting new one
    if (currentSessionId && messages.length > 0) {
      await generateSessionSummary(currentSessionId);
    }
    setCurrentSessionId(null);
    setMessages([]);
    setSelectedChild(null);
    setMessageCount(0);
  };
  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access chat support.</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Chat Controls Header */}
      <div className="bg-white border-b border-gray-200 p-3 sm:p-4">
        <div className="max-w-4xl mx-auto flex justify-end gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowHistorySettings(true)}
            className="text-sm gap-2"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Conversation History Settings</span>
            <span className="sm:hidden">History</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={startNewSession} 
            disabled={isGeneratingSummary} 
            className="text-sm disabled:opacity-50"
          >
            {isGeneratingSummary ? 'Saving...' : 'New Chat'}
          </Button>
        </div>
      </div>

      {/* Welcome Message */}
      {messages.length === 0 && <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-card p-6 sm:p-8 text-center border border-gray-200">
            <div className="flex justify-center mb-6">
              <img src="/stork-avatar.png" alt="Whisperoo" className="w-12 h-12 sm:w-16 sm:h-16 object-contain" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-brand-primary">
              Hi {profile.first_name}, I'm your 24/7 support!
            </h2>
            <p className="text-gray-600 mb-6 text-base sm:text-lg leading-relaxed">I'm ready to offer guidance, share ideas, and suggest trusted experts who can support you even further. I remember our past conversations to better support you over time. You can access your conversation history using the settings button above, and you'll always have the option to view or delete those notes whenever you like.</p>
            
            <p className="text-xs sm:text-sm text-gray-500 mt-8 italic">Note: Whisperoo’s AI Chat Genie provides general information and support only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your pediatrician, physician, or other qualified healthcare provider with any questions you may have regarding your child’s health or well-being.</p>
          </div>
        </div>}

      {/* Messages */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 overflow-hidden">
        <div className="h-full overflow-y-auto space-y-4">
          {messages.map(message => <MessageBubble key={message.id} message={message} selectedChild={selectedChild} />)}
          {isLoading && <div className="flex justify-start mb-4">
              <div className="flex items-start space-x-3 max-w-xs">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white border border-gray-200">
                  <img src="/stork-avatar.png" alt="Whisperoo Assistant" className="w-6 h-6 object-contain" />
                </div>
                <div className="chat-bubble-ai px-4 py-3 shadow-sm mr-12">
                  <div className="flex items-center space-x-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{
                    animationDelay: '0.1s'
                  }}></div>
                      <div className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" style={{
                    animationDelay: '0.2s'
                  }}></div>
                    </div>
                    <span className="text-sm text-gray-500">Typing...</span>
                  </div>
                </div>
              </div>
            </div>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex-1 relative">
              <Input value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder={selectedChild ? `Type anything...` : "Type anything..."} className="rounded-3xl py-3 sm:py-4 text-base shadow-sm" disabled={isLoading} />
            </div>
            <Button onClick={sendMessage} disabled={!inputMessage.trim() || isLoading} className="rounded-3xl px-6 sm:px-8 py-3 sm:py-4 flex items-center space-x-2 font-semibold shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Chat History Settings Modal */}
      <ChatHistorySettings
        open={showHistorySettings}
        onClose={() => setShowHistorySettings(false)}
      />
    </div>;
};
export default Chat;