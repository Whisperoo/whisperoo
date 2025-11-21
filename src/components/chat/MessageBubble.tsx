import React from 'react';
import { User } from 'lucide-react';
import MarkdownText from './MarkdownText';
import ExpertSuggestionCard from './ExpertSuggestionCard';

interface ExpertSuggestion {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  profile_image_url?: string;
  rating: number;
  total_reviews: number;
  consultation_fee: number;
  experience_years?: number;
  location?: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  metadata?: {
    child_id?: string;
    expert_suggestions?: ExpertSuggestion[];
    [key: string]: unknown;
  };
}

interface Child {
  id: string;
  first_name: string;
  age: string;
  is_expecting: boolean;
  expected_name?: string;
}

interface MessageBubbleProps {
  message: Message;
  selectedChild?: Child | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, selectedChild }) => {
  const isUser = message.role === 'user';
  const timestamp = new Date(message.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Get doctor suggestions from metadata
  const expertSuggestions = message.metadata?.expert_suggestions || [];
  const hasExpertSuggestions = !isUser && expertSuggestions.length > 0;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex flex-col space-y-3 max-w-xs sm:max-w-md md:max-w-lg ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Main Message */}
        <div className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          {/* Avatar */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-brand-primary text-white' 
              : 'bg-white border border-gray-200'
          }`}>
            {isUser ? (
              <User className="w-5 h-5" />
            ) : (
              <img 
                src="/stork-avatar.png" 
                alt="Whisperoo Assistant" 
                className="w-6 h-6 object-contain"
              />
            )}
          </div>

          {/* Message Content */}
          <div 
            className={`px-4 py-3 shadow-sm max-w-full ${
              isUser 
                ? 'chat-bubble-user ml-12' 
                : 'chat-bubble-ai mr-12'
            }`}
          >
            {/* Child Context Indicator */}
            {!isUser && selectedChild && (
              <div className="text-xs mb-2 flex items-center font-medium text-brand-dark">
                <span>About {selectedChild.first_name || selectedChild.expected_name}</span>
                {selectedChild.age && (
                  <span className="ml-1">({selectedChild.age})</span>
                )}
              </div>
            )}
            
            {/* Message Text */}
            <div className="text-sm leading-relaxed">
              {isUser ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <MarkdownText content={message.content} />
              )}
            </div>
            
            {/* Timestamp */}
            <div className={`text-xs mt-2 ${isUser ? 'text-white/70' : 'text-gray-500'}`}>
              {timestamp}
            </div>
          </div>
        </div>

        {/* Expert Suggestion Cards */}
        {hasExpertSuggestions && (
          <div className="w-full space-y-3 mr-12">
            <div className="text-sm font-medium text-brand-dark mb-2">
              Recommended Whisperoo Experts:
            </div>
            <div className="flex flex-col space-y-3">
              {expertSuggestions.map((expert) => (
                <ExpertSuggestionCard key={expert.id} expert={expert} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;