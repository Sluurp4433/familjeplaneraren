import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Meal, MealIngredient, MealPlanRow } from '../types/database.types'

export type MealWithIngredients = Meal & { ingredients: MealIngredient[] }

/* ---------- Rätter ---------- */

export function useMeals(groupId: string | null) {
  return useQuery({
    queryKey: ['meals', groupId],
    enabled: !!groupId,
    queryFn: async (): Promise<MealWithIngredients[]> => {
      const { data, error } = await supabase
        .from('meals')
        .select('*, meal_ingredients(*)')
        .eq('group_id', groupId as string)
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []).map((m) => {
        const { meal_ingredients, ...meal } = m as Meal & { meal_ingredients: MealIngredient[] }
        return {
          ...meal,
          ingredients: (meal_ingredients ?? []).sort((a, b) => a.position - b.position),
        }
      })
    },
  })
}

export function useSaveMeal(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      name,
      notes,
      ingredients,
    }: {
      id?: string
      name: string
      notes: string | null
      ingredients: { text: string; quantity: string | null }[]
    }) => {
      let mealId = id
      if (mealId) {
        const { error } = await supabase.from('meals').update({ name, notes }).eq('id', mealId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('meals')
          .insert({ group_id: groupId, name, notes })
          .select('id')
          .single()
        if (error || !data) throw error ?? new Error('Kunde inte skapa')
        mealId = data.id
      }
      await supabase.from('meal_ingredients').delete().eq('meal_id', mealId)
      if (ingredients.length) {
        const { error } = await supabase.from('meal_ingredients').insert(
          ingredients.map((ing, i) => ({
            meal_id: mealId as string,
            text: ing.text,
            quantity: ing.quantity,
            position: i,
          })),
        )
        if (error) throw error
      }
      return mealId
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meals', groupId] }),
  })
}

export function useDeleteMeal(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meals', groupId] }),
  })
}

export function useAddMealToList() {
  return useMutation({
    mutationFn: async ({ mealId, listId }: { mealId: string; listId: string }) => {
      const { data, error } = await supabase.rpc('add_meal_to_list', {
        p_meal: mealId,
        p_list: listId,
      })
      if (error) throw error
      return data as number
    },
  })
}

/* ---------- Veckoplan ---------- */

export function useMealPlan(groupId: string | null, fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ['meal-plan', groupId, fromDate, toDate],
    enabled: !!groupId,
    queryFn: async (): Promise<MealPlanRow[]> => {
      const { data, error } = await supabase
        .from('meal_plan')
        .select('*')
        .eq('group_id', groupId as string)
        .gte('date', fromDate)
        .lte('date', toDate)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSetMealPlan(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      date,
      slot,
      mealId,
      freetext,
    }: {
      date: string
      slot: string
      mealId: string | null
      freetext: string | null
    }) => {
      if (!mealId && !freetext) {
        const { error } = await supabase
          .from('meal_plan')
          .delete()
          .eq('group_id', groupId)
          .eq('date', date)
          .eq('slot', slot)
        if (error) throw error
        return
      }
      const { error } = await supabase
        .from('meal_plan')
        .upsert(
          { group_id: groupId, date, slot, meal_id: mealId, freetext },
          { onConflict: 'group_id,date,slot' },
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan', groupId] }),
  })
}
