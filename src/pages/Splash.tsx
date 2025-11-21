import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, MessageCircle, Shield, Clock, Users, Star, User, Calendar, Monitor, MessageSquare } from 'lucide-react';
import productHero from '@/assets/product-hero.png';
import marthaHammond from '@/assets/martha-hammond.jpg';
const Splash: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    console.log('Splash component mounted');
    setIsVisible(true);
  }, []);
  const handleGetStarted = () => {
    navigate('/auth/create');
  };
  const handleLogin = () => {
    navigate('/auth/login');
  };
  return <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src="/stork-avatar.png" alt="Whisperoo" className="h-8 w-8 object-contain" />
            <span className="text-xl font-semibold text-brand-primary">Whisperoo</span>
          </div>
          <Button variant="outline" onClick={handleLogin}>
            Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`px-6 py-20 transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  You Don’t Have to Know Everything -
                  <span className="text-brand-primary"> Just Where to Turn</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Get personalized, expert-backed parenting advice anytime, anywhere. 
                  Because great parenting doesn't happen on a schedule.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={handleGetStarted} size="lg" className="px-8 py-4 text-lg font-semibold shadow-lg transform hover:scale-105 transition-all duration-200">
                  Start Your Journey
                  <MessageCircle className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" onClick={handleLogin} size="lg" className="px-8 py-4 text-lg font-semibold">
                  I Have an Account
                </Button>
              </div>

              <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Free to start</span>
                </div>
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4 text-green-500" />
                  <span>Trusted Guidance</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span>24/7 available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Feature content */}
            <div className="space-y-8">
              <div className="text-center lg:text-left mb-8">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  Parenting support that fits your life
                </h2>
                <p className="text-xl text-gray-600">
                  Whether it's a midnight feeding question or teenage drama, get the guidance you need when you need it most.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MessageCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Get Direct Answers When You Need It</h3>
                  <p className="text-gray-600">
                    Trained on real parent and expert advice, our AI tool gives you answers day or night. It's fast, judgment-free, and available 24/7.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Book 1:1 Consults with Trusted Pros</h3>
                  <p className="text-gray-600">
                    When one-size-fits-all doesn't cut it, connect with Whisperoo's verified professionals from the comfort of your home.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Monitor className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Take Expert-Led Programs at Home</h3>
                  <p className="text-gray-600">
                    From labor prep with top doulas to pelvic floor recovery with licensed PTs, get access to the best parenting programs designed to fit your schedule.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Ask Anything, Share Everything</h3>
                  <p className="text-gray-600">
                    Join a supportive community of fellow parents navigating the those sleepless nights, burning questions, milestones, and meltdowns.
                  </p>
                </div>
              </div>
            </div>

            {/* Right side - Product imagery */}
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src={productHero} 
                  alt="Parent using Whisperoo app with baby" 
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              
              {/* Floating UI elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-xl p-4 shadow-lg border">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-semibold text-sm">The 3-Month Sleep Plan</p>
                    <p className="text-xs text-gray-500">Build gentle routines that work</p>
                  </div>
                  <button className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-medium">
                    Add Course $18
                  </button>
                </div>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl p-4 shadow-lg border">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-gray-600 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Postpartum Strength and Conditioning</p>
                    <p className="text-xs text-gray-500">Good work, Sara! 50% Complete</p>
                  </div>
                </div>
              </div>

              {/* Expert Consultation Card */}
              <div className="absolute top-16 -left-8 bg-white rounded-full pl-2 pr-6 py-2 shadow-lg border-2 border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full overflow-hidden flex items-center justify-center">
                    <img 
                      src={marthaHammond} 
                      alt="Martha Hammond, Certified Sleep Expert" 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">1:1 with Martha Hammond</p>
                    <p className="text-xs text-gray-500">Certified Sleep Expert</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Get started in minutes
            </h2>
            <p className="text-xl text-gray-600">
              Simple setup, powerful results
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-700 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Create Your Account</h3>
              <p className="text-gray-600">
                Sign up in seconds and tell us about your family's unique situation.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-peach-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Set Up Child Profiles</h3>
              <p className="text-gray-600">
                Add your children's details for personalized, age-appropriate guidance.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-semibold text-gray-900">Start Getting Advice</h3>
              <p className="text-gray-600">
                Ask questions and receive expert-backed advice tailored to your situation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by parents everywhere
            </h2>
            <div className="flex justify-center items-center space-x-2 mb-8">
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />)}
              </div>
              <span className="text-lg text-gray-600">Based on parent feedback</span>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-none shadow-lg">
              <CardContent className="space-y-4">
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />)}
                </div>
                <p className="text-gray-600 italic">
                  "Finally, parenting advice that actually fits my situation. The 3 AM questions are no longer scary!"
                </p>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Sarah M.</p>
                  <p className="text-sm text-gray-500">Mother of 2</p>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 border-none shadow-lg">
              <CardContent className="space-y-4">
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />)}
                </div>
                <p className="text-gray-600 italic">
                  "The personalized profiles for each of my kids makes such a difference. Every child is unique!"
                </p>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Mike R.</p>
                  <p className="text-sm text-gray-500">Father of 3</p>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 border-none shadow-lg">
              <CardContent className="space-y-4">
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />)}
                </div>
                <p className="text-gray-600 italic">
                  "Privacy was my biggest concern, but Whisperoo keeps everything secure while giving amazing advice."
                </p>
                <div className="border-t pt-4">
                  <p className="font-semibold text-gray-900">Jennifer L.</p>
                  <p className="text-sm text-gray-500">Single Mother</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-6 py-20 bg-indigo-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to never parent alone again?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join thousands of parents who've found their confidence with Whisperoo
          </p>
          <Button onClick={handleGetStarted} className="bg-peach-500 hover:bg-peach-600 text-white px-12 py-4 text-lg font-semibold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200">
            Start Your Free Journey Today
          </Button>
          <p className="text-sm text-indigo-200 mt-4">
            No credit card required • Set up in under 5 minutes
          </p>
        </div>
      </section>

    </div>;
};
export default Splash;