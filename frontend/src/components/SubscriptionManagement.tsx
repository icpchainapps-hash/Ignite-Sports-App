import { useState, useEffect } from 'react';
import { X, Check, Lock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useGetCallerTeamsAndClubs } from '../hooks/useQueries';
import { useGetClubSubscription, useUpdateClubSubscription, SubscriptionPlan, getPlanPrice } from '../hooks/useSubscriptionQueries';
import { useCreateCheckoutSession } from '../hooks/usePaymentQueries';
import { toast } from 'sonner';
import { ShoppingItem } from '../backend';

interface SubscriptionManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SubscriptionManagement({ open, onOpenChange }: SubscriptionManagementProps) {
  const [selectedClubId, setSelectedClubId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('free');
  const [inviteCode, setInviteCode] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const { data: teamsAndClubs } = useGetCallerTeamsAndClubs();
  const clubs = teamsAndClubs?.clubs || [];
  
  const { data: subscription } = useGetClubSubscription(selectedClubId);
  const updateSubscription = useUpdateClubSubscription();
  const createCheckoutSession = useCreateCheckoutSession();

  useEffect(() => {
    if (subscription) {
      setSelectedPlan(subscription.plan);
    }
  }, [subscription]);

  useEffect(() => {
    if (clubs.length > 0 && !selectedClubId) {
      setSelectedClubId(clubs[0].id);
    }
  }, [clubs, selectedClubId]);

  const handleApplyInviteCode = async () => {
    if (!inviteCode.trim()) {
      toast.error('Please enter an invite code');
      return;
    }

    // Mock validation - in production this would call backend
    if (inviteCode.toLowerCase() === 'pro2025') {
      try {
        await updateSubscription.mutateAsync({
          clubId: selectedClubId,
          plan: 'pro',
          paymentStatus: 'completed'
        });
        toast.success('Invite code applied! Your club now has Pro access.');
        setInviteCode('');
      } catch (error: any) {
        toast.error(error.message || 'Failed to apply invite code');
      }
    } else {
      toast.error('Invalid invite code');
    }
  };

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (!selectedClubId) {
      toast.error('Please select a club');
      return;
    }

    if (plan === 'free') {
      // Downgrade to free - no payment needed
      try {
        await updateSubscription.mutateAsync({
          clubId: selectedClubId,
          plan: 'free',
          paymentStatus: 'completed'
        });
        toast.success('Downgraded to Free plan');
        setSelectedPlan('free');
      } catch (error: any) {
        toast.error(error.message || 'Failed to update subscription');
      }
      return;
    }

    // For paid plans, initiate payment flow
    setIsProcessingPayment(true);
    
    try {
      // Create shopping items for the subscription
      const price = getPlanPrice(plan);
      const items: ShoppingItem[] = [{
        productName: plan === 'pro' ? 'Pro Plan' : 'Pro Football Plan',
        productDescription: plan === 'pro' 
          ? 'Unlimited teams, club messaging, and photo feed access'
          : 'All Pro features plus Match View for soccer clubs',
        priceInCents: BigInt(price * 100), // Convert to cents
        quantity: BigInt(1),
        currency: 'usd'
      }];

      // Create checkout session
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const successUrl = `${baseUrl}/?payment=success&plan=${plan}&clubId=${selectedClubId}`;
      const cancelUrl = `${baseUrl}/?payment=cancelled`;

      const session = await createCheckoutSession.mutateAsync({
        items,
        successUrl,
        cancelUrl
      });

      // Mark subscription as pending payment
      await updateSubscription.mutateAsync({
        clubId: selectedClubId,
        plan,
        paymentStatus: 'pending'
      });

      // Redirect to Stripe checkout
      toast.info('Redirecting to secure payment...');
      window.location.href = session.url;
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to initiate payment. Please try again.');
      setIsProcessingPayment(false);
    }
  };

  // Check for payment success/failure on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const plan = urlParams.get('plan') as SubscriptionPlan | null;
    const clubId = urlParams.get('clubId');

    if (paymentStatus === 'success' && plan && clubId) {
      // Payment successful - update subscription
      updateSubscription.mutate({
        clubId,
        plan,
        paymentStatus: 'completed'
      }, {
        onSuccess: () => {
          toast.success(`Successfully upgraded to ${plan === 'pro' ? 'Pro' : 'Pro Football'} plan!`);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
    } else if (paymentStatus === 'cancelled') {
      toast.error('Payment cancelled. Your subscription was not changed.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [updateSubscription]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img 
            src="/assets/generated/upgrade-button-icon-emerald-transparent.dim_24x24.png" 
            alt="Subscription" 
            className="h-6 w-6 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold truncate">Subscription Management</h2>
            <p className="text-sm text-muted-foreground truncate">Manage your club's subscription plan</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-9 w-9 flex-shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 space-y-6 max-w-4xl mx-auto">
          {/* Club Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Club</CardTitle>
              <CardDescription>Choose which club's subscription you want to manage</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select a club" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subscription && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Current Plan:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">
                      {subscription.plan === 'free' ? 'Free' : subscription.plan === 'pro' ? 'Pro' : 'Pro Football'}
                    </Badge>
                    {subscription.paymentStatus === 'pending' && (
                      <Badge variant="outline" className="text-amber-600">
                        Payment Pending
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invite Code Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <img 
                  src="/assets/generated/invite-code-entry-interface.dim_300x150.png" 
                  alt="Invite Code" 
                  className="h-5 w-5"
                />
                Have an Invite Code?
              </CardTitle>
              <CardDescription>Enter your invite code to unlock Pro features without payment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="inviteCode"
                    placeholder="Enter invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="h-12 text-base flex-1"
                  />
                  <Button 
                    onClick={handleApplyInviteCode}
                    disabled={updateSubscription.isPending || !inviteCode.trim()}
                    className="h-12"
                  >
                    {updateSubscription.isPending ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact your app administrator for an invite code to unlock Pro features
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Plan Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <Card className={subscription?.plan === 'free' ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <img 
                    src="/assets/generated/free-plan-icon-transparent.dim_32x32.png" 
                    alt="Free" 
                    className="h-8 w-8"
                  />
                  {subscription?.plan === 'free' && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <CardTitle>Free</CardTitle>
                <CardDescription>$0/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Up to 3 teams</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Team messaging</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Team events</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">No club messaging</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">No photo feed</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">No match view</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className={subscription?.plan === 'pro' ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <img 
                    src="/assets/generated/pro-plan-icon-emerald-transparent.dim_32x32.png" 
                    alt="Pro" 
                    className="h-8 w-8"
                  />
                  {subscription?.plan === 'pro' && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <CardTitle>Pro</CardTitle>
                <CardDescription>$10/team/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Unlimited teams</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Club-wide messaging</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Photo feed & vault</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">All Free features</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">No match view</span>
                  </div>
                </div>
                {subscription?.plan !== 'pro' && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => handleUpgrade('pro')}
                    disabled={isProcessingPayment || updateSubscription.isPending}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isProcessingPayment ? 'Processing...' : 'Upgrade to Pro'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Pro Football Plan */}
            <Card className={subscription?.plan === 'proFootball' ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <img 
                    src="/assets/generated/pro-football-plan-icon-emerald-transparent.dim_32x32.png" 
                    alt="Pro Football" 
                    className="h-8 w-8"
                  />
                  {subscription?.plan === 'proFootball' && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <CardTitle>Pro Football</CardTitle>
                <CardDescription>$20/team/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Match View for soccer</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Lineup management</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Substitution planning</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">All Pro features</span>
                  </div>
                </div>
                {subscription?.plan !== 'proFootball' && (
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => handleUpgrade('proFootball')}
                    disabled={isProcessingPayment || updateSubscription.isPending}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isProcessingPayment ? 'Processing...' : 'Upgrade to Pro Football'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Information */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <img 
                  src="/assets/generated/secure-payment-badge.dim_24x24.png" 
                  alt="Secure" 
                  className="h-6 w-6 flex-shrink-0 mt-0.5"
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Secure Payment Processing</p>
                  <p className="text-xs text-muted-foreground">
                    All payments are processed securely through Stripe. Your payment information is never stored on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
