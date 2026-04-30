import React, { useState, useEffect } from "react";
import { Plus, Trash2, Baby } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Input } from "./input";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { toast } from "@/hooks/use-toast";
import {
  calculateAge,
  calculateAgeInYears,
  validateBirthDate,
} from "@/utils/age";
import { validateDueDate, formatDueDate } from "@/utils/kids";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Child {
  id?: string;
  first_name: string;
  birth_date?: string;
  is_expecting?: boolean;
  due_date?: string;
  expected_name?: string;
}

interface ChildrenManagerProps {
  onDataChange?: () => void;
}

const ChildrenManager: React.FC<ChildrenManagerProps> = ({ onDataChange }) => {
  const { t } = useTranslation();
  const { profile, updateProfile } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch children data
  useEffect(() => {
    fetchChildren();
  }, [profile?.id]);

  const fetchChildren = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("kids")
        .select("*")
        .eq("parent_id", profile.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      console.log("Fetched children:", data); // Debug log
      setChildren(data || []);
    } catch (error: any) {
      console.error("Error fetching children:", error);
      toast({
        title: t('childrenManager.failedLoadTitle'),
        description: t('childrenManager.failedLoadDesc'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveChild = async (child: Child) => {
    if (!profile?.id) return;

    try {
      setSaving(true);

      if (child.id) {
        // Update existing child
        const updateData: any = {
          first_name: child.first_name,
          is_expecting: child.is_expecting,
          due_date: child.due_date,
          expected_name: child.expected_name,
        };

        // Add birth_date and age for born children (not expecting)
        if (!child.is_expecting && child.birth_date) {
          updateData.birth_date = child.birth_date;
          updateData.age = calculateAgeInYears(child.birth_date);
        }

        const { error } = await supabase
          .from("kids")
          .update(updateData)
          .eq("id", child.id);

        if (error) throw error;
      } else {
        // Create new child
        const insertData: any = {
          parent_id: profile.id,
          first_name: child.first_name,
          is_expecting: child.is_expecting || false,
          due_date: child.due_date,
          expected_name: child.expected_name,
        };

        // Add birth_date and age for born children (not expecting)
        if (!child.is_expecting && child.birth_date) {
          insertData.birth_date = child.birth_date;
          insertData.age = calculateAgeInYears(child.birth_date);
        }

        const { error } = await supabase.from("kids").insert(insertData);

        if (error) throw error;
      }

      // Refresh the children list immediately
      await fetchChildren();
      await updateKidsCount();
      onDataChange?.();

      toast({
        title: t('childrenManager.childSavedTitle'),
        description: t('childrenManager.childSavedDesc', { name: child.first_name || child.expected_name }),
      });
    } catch (error: any) {
      console.error("Error saving child:", error);
      toast({
        title: t('childrenManager.failedSaveTitle'),
        description: error.message || t('childrenManager.errorTryAgain'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteChild = async (childId: string, childName: string) => {
    if (!confirm(t('childrenManager.confirmRemove', { name: childName }))) return;

    try {
      setSaving(true);

      const { error } = await supabase.from("kids").delete().eq("id", childId);

      if (error) throw error;

      await fetchChildren();
      await updateKidsCount();
      onDataChange?.();

      toast({
        title: t('childrenManager.childRemovedTitle'),
        description: t('childrenManager.childRemovedDesc', { name: childName }),
      });
    } catch (error: any) {
      console.error("Error deleting child:", error);
      toast({
        title: t('childrenManager.failedRemoveTitle'),
        description: error.message || t('childrenManager.errorTryAgain'),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateKidsCount = async () => {
    const bornChildren = children.filter((child) => !child.is_expecting);
    await updateProfile({
      has_kids: bornChildren.length > 0,
      kids_count: bornChildren.length,
    });
  };

  const addNewChild = () => {
    setChildren([
      ...children,
      { first_name: "", birth_date: "", is_expecting: false },
    ]);
  };

  const addExpectingBaby = () => {
    setChildren([
      ...children,
      {
        first_name: "",
        is_expecting: true,
        expected_name: "",
        due_date: "",
      },
    ]);
  };

  const updateChild = (index: number, updates: Partial<Child>) => {
    const newChildren = [...children];
    newChildren[index] = { ...newChildren[index], ...updates };
    setChildren(newChildren);
  };

  const removeChild = (index: number) => {
    const child = children[index];
    if (child.id) {
      deleteChild(child.id, child.first_name || child.expected_name || "child");
    } else {
      // Just remove from local state if not saved yet
      const newChildren = children.filter((_, i) => i !== index);
      setChildren(newChildren);
    }
  };

  if (loading) {
    return <div className="text-center py-4">{t('childrenManager.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* <h3 className="text-lg font-semibold">Children</h3> */}
        <div className="flex gap-2">
          <Button
            onClick={addNewChild}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('childrenManager.addChild')}
          </Button>
          <Button
            onClick={addExpectingBaby}
            variant="outline"
            size="sm"
            disabled={saving}
          >
            <Baby className="w-4 h-4 mr-1" />
            {t('childrenManager.expecting')}
          </Button>
        </div>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            {t('childrenManager.noChildren')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {children.map((child, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {child.is_expecting ? t('childrenManager.expectedBaby') : t('childrenManager.child')} {index + 1}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {child.is_expecting && (
                      <Badge
                        variant="secondary"
                        className="bg-pink-100 text-pink-700"
                      >
                        {t('childrenManager.expecting')}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeChild(index)}
                      disabled={saving}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {child.is_expecting ? (
                  // Expecting baby fields
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('childrenManager.babyNameLabel')}
                      </label>
                      <Input
                        value={child.expected_name || ""}
                        onChange={(e) =>
                          updateChild(index, { expected_name: e.target.value })
                        }
                        placeholder={t('childrenManager.babyNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('childrenManager.dueDate')}
                      </label>
                      <Input
                        type="date"
                        value={child.due_date || ""}
                        onChange={(e) =>
                          updateChild(index, { due_date: e.target.value })
                        }
                      />
                      {child.due_date && (
                        <p className="text-xs text-gray-600 mt-1">
                          {t('childrenManager.due')}{formatDueDate(child.due_date)}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  // Born child fields
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('childrenManager.name')}
                      </label>
                      <Input
                        value={child.first_name}
                        onChange={(e) =>
                          updateChild(index, { first_name: e.target.value })
                        }
                        placeholder={t('childrenManager.childNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {t('childrenManager.birthDate')}
                      </label>
                      <Input
                        type="date"
                        value={child.birth_date || ""}
                        onChange={(e) =>
                          updateChild(index, { birth_date: e.target.value })
                        }
                      />
                      {child.birth_date &&
                        validateBirthDate(child.birth_date).isValid && (
                          <p className="text-xs text-gray-600 mt-1">
                            {t('childrenManager.age')}{calculateAge(child.birth_date)}
                          </p>
                        )}
                      {child.birth_date &&
                        !validateBirthDate(child.birth_date).isValid && (
                          <p className="text-xs text-red-500 mt-1">
                            {validateBirthDate(child.birth_date).error}
                          </p>
                        )}
                    </div>
                  </>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveChild(child)}
                    disabled={
                      saving ||
                      (child.is_expecting
                        ? !child.expected_name?.trim() || !child.due_date
                        : !child.first_name.trim() || !child.birth_date)
                    }
                    size="sm"
                  >
                    {saving ? t('childrenManager.saving') : child.id ? t('childrenManager.update') : t('childrenManager.save')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChildrenManager;
