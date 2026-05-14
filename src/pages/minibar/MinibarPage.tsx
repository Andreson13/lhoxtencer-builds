import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { useI18n } from '@/contexts/I18nContext';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatFCFA } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wine, Plus, ShoppingCart, AlertTriangle } from 'lucide-react';

const MinibarPage = () => {
  useRoleGuard(['admin', 'manager', 'receptionist', 'restaurant']);
  const { t } = useI18n();
  const { hotel } = useHotel();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellItem, setSellItem] = useState<any>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: minibarItems, isLoading } = useQuery({
    queryKey: ['minibar', hotel?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items' as any)
        .select('id, name, category, unit, selling_price, current_stock, minimum_stock, is_minibar, hotel_id, created_at')
        .eq('hotel_id', hotel!.id)
        .eq('is_minibar', true)
        .order('category, name');
      if (error) throw error;
      return data;
    },
    enabled: !!hotel?.id,
  });

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!sellItem || !sellQuantity || !hotel) throw new Error('Missing data');
      if (sellQuantity > sellItem.current_stock) throw new Error(`Insufficient stock! Only ${sellItem.current_stock} available.`);
      if (sellQuantity <= 0) throw new Error('Quantity must be greater than 0');
      const newStock = sellItem.current_stock - sellQuantity;
      const { error } = await supabase
        .from('inventory_items' as any)
        .update({ current_stock: newStock })
        .eq('id', sellItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['minibar', hotel?.id] });
      toast.success(`${sellQuantity}x ${sellItem.name} sold`);
      setSellDialogOpen(false);
      setSellItem(null);
      setSellQuantity(1);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Get unique categories
  const categories = Array.from(
    new Set(minibarItems?.map(item => item.category).filter(Boolean) || [])
  ).sort() as string[];

  // Filter items
  const filtered = minibarItems?.filter(item => {
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }) || [];

  // Group by category
  const groupedItems = filtered.reduce((acc: any, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="page-container space-y-6">
      <PageHeader
        title="Minibar"
        subtitle={`${minibarItems?.length || 0} items available`}
      >
        <Button disabled><Plus className="h-4 w-4 mr-2" />Manage Minibar</Button>
      </PageHeader>

      {/* Filters */}
      <div className="space-y-4">
        <Input
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-md"
        />

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoryFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter('all')}
            >
              All Categories
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wine}
          title="No items found"
          description="No minibar items match your search"
        />
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, items]: [string, any]) => (
            <div key={category}>
              <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map((item: any) => {
                  const isLowStock = item.current_stock <= (item.minimum_stock || 3);
                  return (
                    <Card
                      key={item.id}
                      className={`overflow-hidden transition-all hover:shadow-lg ${
                        isLowStock ? 'border-destructive/50 bg-destructive/5' : ''
                      }`}
                    >
                      <CardContent className="p-4 flex flex-col h-full">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-sm leading-tight">{item.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{item.unit}</p>
                            </div>
                            {isLowStock && (
                              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-1" />
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Price:</span>
                              <span className="font-semibold text-green-600">
                                {formatFCFA(item.selling_price)}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Stock:</span>
                              <Badge variant={isLowStock ? 'destructive' : 'secondary'}>
                                {item.current_stock} / {item.minimum_stock || 3}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => {
                            setSellItem(item);
                            setSellQuantity(1);
                            setSellDialogOpen(true);
                          }}
                          disabled={item.current_stock === 0}
                          className="w-full mt-4"
                          size="sm"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Sell
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sell Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sell - {sellItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Current stock: {sellItem?.current_stock}</p>
              <p className="text-sm text-muted-foreground">Selling price: {formatFCFA(sellItem?.selling_price)}</p>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                max={sellItem?.current_stock}
                value={sellQuantity}
                onChange={e => setSellQuantity(Number(e.target.value))}
              />
              {sellQuantity > (sellItem?.current_stock || 0) && (
                <p className="text-sm text-destructive mt-2">⚠️ Quantity exceeds available stock!</p>
              )}
            </div>
            <p className="text-lg font-semibold">
              Total: {formatFCFA((sellItem?.selling_price || 0) * sellQuantity)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => sellMutation.mutate()}
              disabled={sellMutation.isPending || !sellQuantity || sellQuantity > (sellItem?.current_stock || 0)}
            >
              Confirm Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinibarPage;
