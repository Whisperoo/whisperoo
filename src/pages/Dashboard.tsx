import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserResources } from '@/components/dashboard/UserResources';
import AIMomCallModule from '@/components/dashboard/AIMomCallModule';
const Dashboard: React.FC = () => {
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  const firstName = profile?.first_name || 'there';
  const isMobile = useIsMobile();
  return <main className={`${isMobile ? 'px-4 py-6' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-brand-primary mb-2">
            Hi {firstName}!
          </h1>
          <p className="text-gray-600">
            Welcome to the club! Your go-to place for parenting answers, expert advice, and support.
          </p>
        </div>

        {/* 24/7 Support Card - Featured */}
        <div onClick={() => navigate('/chat')} className="bg-white rounded-xl shadow-card p-6 mb-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <img src="/stork-avatar.png" alt="Whisperoo" className="w-8 h-8 object-contain" />
                <MessageCircle className="w-5 h-5 text-brand-primary" />
              </div>
              <h2 className="text-lg font-semibold text-brand-primary">
                Start Chat Genie with Whisperoo
              </h2>
            </div>
            <ArrowRight className="w-5 h-5 text-brand-primary" />
          </div>
          <p className="text-gray-600 leading-relaxed">Genie remembers you and your family’s journey so answers are tailored, not generic. Get instant guidance, plus expert recommendations at any hour of the day.</p>
        </div>

        {/* AI Mom Call Module */}
        <AIMomCallModule />

        {/* Dynamic User Resources */}
        <UserResources />

        {/* Explore Card */}
        <div className="bg-white rounded-xl shadow-card p-6 border border-gray-200 cursor-pointer hover:shadow-elevated transition-all duration-200 hover:border-brand-primary" onClick={() => navigate('/experts')}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-brand-primary">
              Explore Whisperoo Verified Experts
            </h2>
            <ArrowRight className="w-5 h-5 text-brand-primary" />
          </div>
          <p className="text-gray-600 leading-relaxed">
            Connect with board-certified professionals who specialize in child and family health
          </p>
        </div>
    </main>;
};
export default Dashboard;