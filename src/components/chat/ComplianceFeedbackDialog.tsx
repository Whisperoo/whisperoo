import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface ComplianceFeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageContent: string;
  userQuery?: string;
}

const ComplianceFeedbackDialog: React.FC<ComplianceFeedbackDialogProps> = ({ 
  isOpen, onClose, messageContent, userQuery 
}) => {
  const [classification, setClassification] = useState<string>('no_answer');
  const [additionalFeedback, setAdditionalFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const authObj = await supabase.auth.getUser();
      const user = authObj.data.user;

      const { error } = await supabase.from('compliance_training').insert({
        user_query: userQuery || "Unable to capture query",
        ai_response: additionalFeedback.trim() 
          ? `${messageContent}\n\n---\nUser feedback: ${additionalFeedback.trim()}`
          : messageContent,
        classification: classification,
        status: 'user_feedback',
        tester_id: user?.id
      });

      if (error) throw error;
      
      toast({
        title: "Feedback Sent",
        description: "Thank you for helping us improve Whisperoo.",
      });
      
      // Reset form
      setClassification('no_answer');
      setAdditionalFeedback('');
      onClose();
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Help us improve this answer</DialogTitle>
          <DialogDescription>
            Your feedback helps us make Whisperoo better for you and other parents.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">What didn't feel right?</label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_answer">This doesn't answer my question</SelectItem>
                <SelectItem value="too_generic">Feels too generic or not personalized</SelectItem>
                <SelectItem value="unsafe_concerning">This felt unsafe or concerning</SelectItem>
                <SelectItem value="tone_off">Tone felt off</SelectItem>
                <SelectItem value="slow_buggy">Slow or buggy</SelectItem>
                <SelectItem value="other">Something else</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">
              Tell us more information or suggest what would have been more helpful (Optional)
            </label>
            <Textarea 
              placeholder="Type your thoughts here..." 
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              className="h-24 resize-none" 
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComplianceFeedbackDialog;
