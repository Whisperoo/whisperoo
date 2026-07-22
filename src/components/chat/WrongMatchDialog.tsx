import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface WrongMatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  expertId: string;
  expertName: string;
  detectedCategory?: string | null;
  userQuery?: string;
}

const WrongMatchDialog: React.FC<WrongMatchDialogProps> = ({
  isOpen, onClose, messageId, expertId, expertName, detectedCategory, userQuery,
}) => {
  const [reason, setReason] = useState<string>('wrong_specialty');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const authObj = await supabase.auth.getUser();
      const user = authObj.data.user;
      if (!user) throw new Error('Not signed in.');

      const { error } = await supabase.from('expert_recommendation_feedback').insert({
        message_id: messageId,
        user_id: user.id,
        expert_id: expertId,
        detected_category: detectedCategory ?? null,
        user_query: userQuery ?? null,
        reason,
        comment: comment.trim() || null,
      });
      if (error) throw error;

      toast({
        title: 'Thanks for flagging',
        description: 'This helps us tune expert recommendations.',
      });
      setReason('wrong_specialty');
      setComment('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      toast({ title: 'Submission failed', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wrong match?</DialogTitle>
          <DialogDescription>
            Tell us why <span className="font-medium">{expertName}</span> wasn&apos;t the right recommendation for this question.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">What was wrong?</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wrong_specialty">Wrong specialty for my question</SelectItem>
                <SelectItem value="not_relevant">Not relevant to what I asked</SelectItem>
                <SelectItem value="other">Something else</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">
              What kind of expert would have been more helpful? (Optional)
            </label>
            <Textarea
              placeholder="E.g. I was asking about toddler potty training, not postpartum recovery..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-24 resize-none"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WrongMatchDialog;
