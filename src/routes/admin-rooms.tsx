import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Image as ImageIcon, DollarSign, Clock } from "lucide-react";
import { bookingsDB, type DBRoomCategory } from "@/integrations/supabase/bookings";
import { useHotel } from "@/contexts/HotelContext";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-rooms")({
  head: () => ({
    meta: [
      { title: "Room Management — Hotel Harmony" },
      { name: "description", content: "Manage room categories, images, and pricing." },
    ],
  }),
  component: AdminRoomsPage,
});

function AdminRoomsPage() {
  const { hotelId } = useHotel();
  const [categories, setCategories] = useState<DBRoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_per_night: 0,
    price_sieste: 0,
    features: [] as string[],
    color: "#3B82F6",
    display_order: 0,
  });

  useEffect(() => {
    loadCategories();
  }, [hotelId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await bookingsDB.getRoomCategories(hotelId);
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories:", err);
      toast.error("Failed to load room categories");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editingId) {
        // Update existing category
        await bookingsDB.updateRoomCategory(editingId, {
          name: formData.name,
          description: formData.description,
          price_per_night: formData.price_per_night,
          price_sieste: formData.price_sieste,
          features: formData.features,
          color: formData.color,
          display_order: formData.display_order,
        });
        toast.success("Category updated");
      } else {
        // Create new category
        await bookingsDB.createRoomCategory({
          hotel_id: hotelId,
          name: formData.name,
          description: formData.description,
          price_per_night: formData.price_per_night,
          price_sieste: formData.price_sieste,
          features: formData.features,
          color: formData.color,
          display_order: formData.display_order,
          portal_visible: true,
        });
        toast.success("Category created");
      }

      resetForm();
      loadCategories();
    } catch (err) {
      console.error("Failed to save category:", err);
      toast.error("Failed to save category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      await bookingsDB.deleteRoomCategory(id);
      toast.success("Category deleted");
      loadCategories();
    } catch (err) {
      console.error("Failed to delete category:", err);
      toast.error("Failed to delete category");
    }
  };

  const handleEditCategory = (category: DBRoomCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      description: category.description || "",
      price_per_night: category.price_per_night,
      price_sieste: category.price_sieste || 0,
      features: category.features || [],
      color: category.color || "#3B82F6",
      display_order: category.display_order || 0,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      price_per_night: 0,
      price_sieste: 0,
      features: [],
      color: "#3B82F6",
      display_order: 0,
    });
  };

  const handleAddFeature = (feature: string) => {
    if (feature && !formData.features.includes(feature)) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, feature],
      }));
    }
  };

  const handleRemoveFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-navy">Room Category Management</h1>
          <p className="mt-2 text-muted-foreground">
            Configure room categories, pricing, images, and features
          </p>
        </div>

        <Tabs defaultValue="categories" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
          </TabsList>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingId ? "Edit Category" : "New Category"}
                </CardTitle>
                <CardDescription>
                  {editingId ? "Update category details" : "Create a new room category"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Category Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Prestige Gold Suite"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Describe this room category..."
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price_per_night">Price Per Night</Label>
                    <Input
                      id="price_per_night"
                      type="number"
                      value={formData.price_per_night}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          price_per_night: parseInt(e.target.value),
                        }))
                      }
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="price_sieste">Sieste Price (hourly)</Label>
                    <Input
                      id="price_sieste"
                      type="number"
                      value={formData.price_sieste}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          price_sieste: parseInt(e.target.value),
                        }))
                      }
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="color">Color</Label>
                    <div className="mt-2 flex gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, color: e.target.value }))
                        }
                        className="h-10 w-20"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, color: e.target.value }))
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="display_order">Display Order</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          display_order: parseInt(e.target.value),
                        }))
                      }
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label>Features</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm"
                      >
                        {feature}
                        <button
                          onClick={() => handleRemoveFeature(feature)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      id="feature-input"
                      placeholder="Add feature (WiFi, AC, etc.)"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          handleAddFeature(e.currentTarget.value);
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById(
                          "feature-input"
                        ) as HTMLInputElement;
                        if (input) {
                          handleAddFeature(input.value);
                          input.value = "";
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-4">
                  <Button onClick={handleSaveCategory} className="flex-1">
                    {editingId ? "Update Category" : "Create Category"}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Categories List */}
            <Card>
              <CardHeader>
                <CardTitle>Room Categories ({categories.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <p className="text-muted-foreground">Loading categories...</p>
                ) : categories.length === 0 ? (
                  <p className="text-muted-foreground">No categories yet</p>
                ) : (
                  <div className="grid gap-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-start justify-between rounded-lg border border-border p-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-6 w-6 rounded"
                              style={{ backgroundColor: category.color }}
                            />
                            <h3 className="font-semibold">{category.name}</h3>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {category.description}
                          </p>
                          <div className="mt-2 flex gap-4 text-sm">
                            <span>
                              💰 {category.price_per_night} per night
                            </span>
                            {category.price_sieste && (
                              <span>
                                ⏰ {category.price_sieste} per hour (sieste)
                              </span>
                            )}
                          </div>
                          {category.features && category.features.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {category.features.map((f) => (
                                <span
                                  key={f}
                                  className="rounded-full bg-secondary px-2 py-1 text-xs"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCategory(category)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Service Pricing
                </CardTitle>
                <CardDescription>
                  Configure add-on service prices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Service pricing will be configured here. Prices are set per
                  category above under "Price Per Night" and "Sieste Price".
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gallery Tab */}
          <TabsContent value="gallery" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Category Gallery
                </CardTitle>
                <CardDescription>
                  Upload and manage images for room categories
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create room categories first
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="rounded-lg border border-border p-4"
                      >
                        <h3 className="font-semibold">{category.name}</h3>
                        <div className="mt-4">
                          <Label>Upload Images</Label>
                          <div className="mt-2 flex gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              multiple
                              className="flex-1"
                            />
                            <Button variant="outline">Upload</Button>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Recommended: 600×400px or larger, JPG/PNG format
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
