import React, { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Star,
  Download,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Purchase {
  id: string;
  amount: number;
  status: string;
  purchased_at: string;
  product_id: string;
  user_id: string;
  metadata: { product_title?: string };
}

interface Product {
  id: string;
  title: string;
  price: number;
  product_type: string;
  is_active: boolean;
  view_count: number;
}

interface ProductStat {
  product: Product;
  revenue: number;
  sales: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  sales: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function exportCSV(purchases: Purchase[], products: Product[]) {
  const productMap = new Map(products.map((p) => [p.id, p.title]));
  const rows = [
    ["Date", "Product", "Amount", "Status"],
    ...purchases.map((p) => [
      format(parseISO(p.purchased_at), "yyyy-MM-dd"),
      productMap.get(p.product_id) || p.metadata?.product_title || "—",
      p.amount.toFixed(2),
      p.status,
    ]),
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number; // percentage change vs last month
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
}) => (
  <Card className="relative overflow-hidden border-0 shadow-md">
    <div className={`absolute inset-0 opacity-5 ${color}`} />
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl ${color} bg-opacity-10`}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {trend >= 0 ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${
              trend >= 0 ? "text-green-600" : "text-red-500"
            }`}
          >
            {Math.abs(trend).toFixed(1)}% vs last month
          </span>
        </div>
      )}
    </CardContent>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const SalesAnalyticsDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, productsRes] = await Promise.all([
        supabase
          .from("purchases")
          .select("id, amount, status, purchased_at, product_id, user_id, metadata")
          .eq("expert_id", profile!.id)
          .eq("status", "completed")
          .order("purchased_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, title, price, product_type, is_active, view_count")
          .eq("expert_id", profile!.id),
      ]);

      if (purchasesRes.data) setPurchases(purchasesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (e) {
      console.error("SalesAnalyticsDashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const thisMonthPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        const d = parseISO(p.purchased_at);
        return d >= thisMonthStart && d <= thisMonthEnd;
      }),
    [purchases]
  );

  const lastMonthPurchases = useMemo(
    () =>
      purchases.filter((p) => {
        const d = parseISO(p.purchased_at);
        return d >= lastMonthStart && d <= lastMonthEnd;
      }),
    [purchases]
  );

  const totalRevenue = useMemo(
    () => purchases.reduce((sum, p) => sum + Number(p.amount), 0),
    [purchases]
  );

  const thisMonthRevenue = useMemo(
    () => thisMonthPurchases.reduce((sum, p) => sum + Number(p.amount), 0),
    [thisMonthPurchases]
  );

  const lastMonthRevenue = useMemo(
    () => lastMonthPurchases.reduce((sum, p) => sum + Number(p.amount), 0),
    [lastMonthPurchases]
  );

  const revenueTrend =
    lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : undefined;

  const salesTrend =
    lastMonthPurchases.length > 0
      ? ((thisMonthPurchases.length - lastMonthPurchases.length) /
          lastMonthPurchases.length) *
        100
      : undefined;

  const uniqueBuyers = useMemo(
    () => new Set(purchases.map((p) => p.user_id)).size,
    [purchases]
  );

  // ── Monthly chart data (last 6 months) ──────────────────────────────────

  const monthlyData: MonthlyData[] = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const monthPurchases = purchases.filter((p) => {
        const d = parseISO(p.purchased_at);
        return d >= start && d <= end;
      });
      return {
        month: format(monthDate, "MMM"),
        revenue: monthPurchases.reduce((s, p) => s + Number(p.amount), 0),
        sales: monthPurchases.length,
      };
    });
  }, [purchases]);

  // ── Top products ──────────────────────────────────────────────────────────

  const productStats: ProductStat[] = useMemo(() => {
    const statsMap = new Map<string, { revenue: number; sales: number }>();
    purchases.forEach((p) => {
      const existing = statsMap.get(p.product_id) || { revenue: 0, sales: 0 };
      statsMap.set(p.product_id, {
        revenue: existing.revenue + Number(p.amount),
        sales: existing.sales + 1,
      });
    });

    return products
      .map((product) => {
        const stats = statsMap.get(product.id) || { revenue: 0, sales: 0 };
        return { product, ...stats };
      })
      .filter((s) => s.sales > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [purchases, products]);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Sales Analytics</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your revenue and product performance
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(purchases, products)}
          className="gap-2"
          disabled={purchases.length === 0}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {purchases.length === 0 ? (
        // Empty state
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-indigo-50 rounded-full mb-4">
              <TrendingUp className="h-8 w-8 text-indigo-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-700 mb-1">
              No sales yet
            </h4>
            <p className="text-sm text-gray-400 max-w-sm">
              Once customers purchase your products, your sales data will appear
              here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              subtitle="All time"
              icon={<DollarSign className="h-5 w-5 text-green-600" />}
              color="bg-green-500"
            />
            <StatCard
              title="This Month"
              value={formatCurrency(thisMonthRevenue)}
              icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
              trend={revenueTrend}
              color="bg-indigo-500"
            />
            <StatCard
              title="Total Sales"
              value={String(purchases.length)}
              subtitle={`${thisMonthPurchases.length} this month`}
              icon={<ShoppingBag className="h-5 w-5 text-purple-600" />}
              trend={salesTrend}
              color="bg-purple-500"
            />
            <StatCard
              title="Unique Buyers"
              value={String(uniqueBuyers)}
              icon={<Star className="h-5 w-5 text-amber-600" />}
              color="bg-amber-500"
            />
          </div>

          {/* Revenue Chart */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800">
                Revenue — Last 6 Months
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={monthlyData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "13px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products Table */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                Top Performing Products
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {productStats.map(({ product, revenue, sales }, i) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold text-gray-300 w-5 shrink-0">
                      #{i + 1}
                    </span>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {product.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize py-0"
                        >
                          {product.product_type}
                        </Badge>
                        {!product.is_active && (
                          <Badge variant="destructive" className="text-xs py-0">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(revenue)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {sales} {sales === 1 ? "sale" : "sales"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="shadow-md border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-50">
                {purchases.slice(0, 8).map((p) => {
                  const product = products.find((pr) => pr.id === p.product_id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {product?.title ||
                            p.metadata?.product_title ||
                            "Product"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(parseISO(p.purchased_at), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-green-600">
                        +{formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  );
                })}
              </div>
              {purchases.length > 8 && (
                <div className="px-6 py-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400 text-center">
                    Showing 8 of {purchases.length} transactions — export CSV for full history
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SalesAnalyticsDashboard;
