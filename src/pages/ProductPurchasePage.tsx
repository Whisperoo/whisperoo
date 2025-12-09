import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { productService, ProductWithDetails } from '@/services/products';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/utils';
import { StripeCheckout } from '@/components/payments/StripeCheckout';

export const ProductPurchasePage: React.FC = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const { data: product, isLoading, error } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? productService.getProduct(productId) : null,
        enabled: !!productId,
    });

    useEffect(() => {
        if (!user) {
            navigate('/auth/login');
        }
    }, [user, navigate]);

    const handlePaymentSuccess = (purchaseId: string) => {
        navigate(`/purchase-success/${productId}`);
    };

    const handlePaymentError = (error: string) => {
        console.error('Payment error:', error);
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center">Loading...</div>
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
                            <p className="text-muted-foreground">Product not found</p>
                            <Button onClick={() => navigate(-1)} className="mt-4">
                                Go Back
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Payment Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <StripeCheckout
                                    productId={product.id}
                                    productTitle={product.title}
                                    amount={product.price}
                                    onSuccess={handlePaymentSuccess}
                                    onError={handlePaymentError}
                                    onCancel={() => navigate(-1)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card>
                            <CardHeader>
                                <CardTitle>Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <h3 className="font-semibold mb-1">{product.title}</h3>
                                    <Badge className="capitalize">{product.product_type}</Badge>
                                </div>

                                {product.expert && (
                                    <div className="text-sm text-muted-foreground">
                                        By {product.expert.first_name}
                                    </div>
                                )}

                                <div className="border-t pt-4">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span>{formatCurrency(product.price)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span>{formatCurrency(product.price)}</span>
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