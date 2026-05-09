import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CreditCard } from "lucide-react";
import { productService, ProductWithDetails } from "@/services/products";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { StripeCheckout } from "@/components/payments/StripeCheckout";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export const ProductPurchasePage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [discountCode, setDiscountCode] = useState("");
  const [discountStatus, setDiscountStatus] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
  const [discountInfo, setDiscountInfo] = useState<{ type: "percentage" | "fixed"; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState("");

  const [isGift, setIsGift] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => (productId ? productService.getProduct(productId) : null),
    enabled: !!productId,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth/login");
    }
  }, [user, navigate]);

  const handlePaymentSuccess = (purchaseId: string) => {
    toast.success(t('checkout.paymentSuccessToast'));
    // navigate(`/purchase-success/${purchaseId}`);
    navigate(`/my-purchases`);
  };

  const handlePaymentError = (error: string) => {
    console.error("Payment error:", error);
  };

  const applyDiscount = async () => {
    if (!discountCode.trim()) return;
    setDiscountStatus("validating");
    setDiscountError("");

    try {
      const result = await productService.validateDiscountCode(discountCode.trim());
      if (result.isValid && result.discountType && result.discountAmount) {
        setDiscountStatus("valid");
        setDiscountInfo({ type: result.discountType, amount: result.discountAmount });
        toast.success("Discount code applied successfully!");
      } else {
        setDiscountStatus("invalid");
        setDiscountError(result.error || "Invalid discount code");
        setDiscountInfo(null);
      }
    } catch (e) {
      setDiscountStatus("invalid");
      setDiscountError("Failed to validate code");
      setDiscountInfo(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">{t('checkout.loading')}</div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">{t('checkout.notFound')}</p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                {t('checkout.back')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const basePrice = product.price;
  let finalPrice = basePrice;
  let discountValue = 0;

  if (discountInfo) {
    if (discountInfo.type === "percentage") {
      discountValue = basePrice * (discountInfo.amount / 100);
    } else if (discountInfo.type === "fixed") {
      discountValue = discountInfo.amount;
    }
    finalPrice = Math.max(0, basePrice - discountValue);
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('checkout.back')}
        </Button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t('checkout.paymentInfo')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGift && (
                  <div className="mb-6 space-y-4 border p-4 rounded-lg bg-slate-50">
                    <h3 className="font-semibold text-lg">Gift Details</h3>
                    <div className="space-y-2">
                      <Label>Recipient Name</Label>
                      <Input 
                        placeholder="e.g. Jane Doe" 
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recipient Email</Label>
                      <Input 
                        type="email"
                        placeholder="jane@example.com" 
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message (Optional)</Label>
                      <Textarea 
                        placeholder="Enjoy this gift!" 
                        value={giftMessage}
                        onChange={(e) => setGiftMessage(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <StripeCheckout
                  productId={product.id}
                  productTitle={product.title}
                  amount={finalPrice}
                  discountCode={discountStatus === "valid" ? discountCode : undefined}
                  giftInfo={isGift && recipientEmail ? { recipientEmail, recipientName, giftMessage } : undefined}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={() => navigate(-1)}
                  onDiscountChange={(discountedAmt, code) => {
                    if (discountedAmt !== null && code) {
                      // Sync sidebar Order Summary with the actual server-computed discount
                      const savings = basePrice - discountedAmt;
                      setDiscountCode(code);
                      setDiscountInfo({ type: 'fixed', amount: savings });
                      setDiscountStatus('valid');
                    } else {
                      // Promo removed
                      setDiscountInfo(null);
                      setDiscountCode('');
                      setDiscountStatus('idle');
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>{t('checkout.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-1">{product.title}</h3>
                  <Badge className="capitalize">{product.product_type}</Badge>
                </div>

                {product.expert && (
                  <div className="text-sm text-muted-foreground">
                    {t('checkout.by', { name: product.expert.first_name })}
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                    <div>
                      <h4 className="font-medium text-sm text-indigo-900">Is this a gift?</h4>
                      <p className="text-xs text-indigo-700">Send this product to a friend or family member</p>
                    </div>
                    <Switch checked={isGift} onCheckedChange={setIsGift} />
                  </div>

                  {/* Discount Section */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Discount code"
                        value={discountCode}
                        onChange={(e) => {
                          setDiscountCode(e.target.value);
                          if (discountStatus === "invalid") setDiscountStatus("idle");
                        }}
                        disabled={discountStatus === "validating" || discountStatus === "valid"}
                        className={discountStatus === "invalid" ? "border-red-500" : ""}
                      />
                      <Button
                        variant={discountStatus === "valid" ? "outline" : "secondary"}
                        onClick={() => {
                          if (discountStatus === "valid") {
                            setDiscountStatus("idle");
                            setDiscountCode("");
                            setDiscountInfo(null);
                            setDiscountError("");
                          } else {
                            applyDiscount();
                          }
                        }}
                        disabled={!discountCode.trim() || discountStatus === "validating"}
                      >
                        {discountStatus === "validating" ? "..." : discountStatus === "valid" ? "Remove" : "Apply"}
                      </Button>
                    </div>
                    {discountStatus === "invalid" && discountError && (
                      <p className="text-sm text-red-500">{discountError}</p>
                    )}
                  </div>

                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
                      <span>{formatCurrency(basePrice)}</span>
                    </div>
                    
                    {discountInfo && (
                      <div className="flex justify-between mb-2 text-green-600">
                        <span>Discount ({discountCode.toUpperCase()})</span>
                        <span>-{formatCurrency(discountValue)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-lg mt-2 border-t pt-2">
                      <span>{t('checkout.total')}</span>
                      <span>{formatCurrency(finalPrice)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
