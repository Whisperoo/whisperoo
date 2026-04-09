import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
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
  const [classification, setClassification] = useState<string>('missed_escalation');
  const [customClassification, setCustomClassification] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Use custom classification if "other" is selected
    const finalClassification = classification === 'other' 
      ? (customClassification.trim() || 'Other') 
      : classification;

    try {
      const authObj = await supabase.auth.getUser();
      const user = authObj.data.user;

      const { error } = await supabase.from('compliance_training').insert({
        user_query: userQuery || "Unable to capture query",
        ai_response: messageContent,
        classification: finalClassification,
        status: 'draft',
        tester_id: user?.id
      });

      if (error) throw error;
      
      toast({
        title: "Feedback Submitted",
        description: "Thank you for helping train the AI.",
      });
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
          <DialogTitle>AI Compliance Feedback</DialogTitle>
          <DialogDescription>Flag this response for the AI training review queue.</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Issue Type</label>
            <Select value={classification} onValueChange={setClassification}>
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="missed_escalation">Missed Escalation</SelectItem>
                <SelectItem value="bad_medical_advice">Bad Medical Advice</SelectItem>
                <SelectItem value="inappropriate_tone">Inappropriate Tone</SelectItem>
                <SelectItem value="false_positive">False Positive (Unnecessary Escalation)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {classification === 'other' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <label className="text-sm font-medium">Please specify</label>
              <Input 
                placeholder="Describe the issue..." 
                value={customClassification}
                onChange={(e) => setCustomClassification(e.target.value)}
                maxLength={50}
              />
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">AI Response Context</label>
            <Textarea 
              value={messageContent} 
              readOnly 
              className="h-24 bg-gray-50 text-xs text-gray-500" 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit to Queue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComplianceFeedbackDialog;
