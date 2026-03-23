import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getTelegramId, getTelegramUser, hapticFeedback } from "@/lib/telegram";
import { FarmData, FarmAction } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function safeHeader(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return "";
  }
}

// Стабильный ID на всю сессию — не меняется при ре-рендерах.
// Если Telegram контекст доступен сразу — берём реальный ID и фиксируем его.
// Если ещё не доступен — берём из localStorage. Не генерируем demo ID
// пока не убедились что реального нет.
let _stableId: string | null = null;

function getStableTelegramId(): string {
  // Если уже определили — возвращаем
  if (_stableId) return _stableId;

  // Пытаемся взять из Telegram контекста
  try {
    const tg = (window as any)?.Telegram?.WebApp;
    const rawId = tg?.initDataUnsafe?.user?.id;
    console.log("[Farm] Telegram initData:", { rawId, user: tg?.initDataUnsafe?.user });
    if (rawId) {
      const realId = String(rawId);
      localStorage.setItem("tg_real_id", realId);
      _stableId = realId;
      console.log("[Farm] stableId set from Telegram:", realId);
      return realId;
    }
  } catch (e) {
    console.warn("[Farm] Telegram context error:", e);
  }

  // Пробуем localStorage кеш
  try {
    const cached = localStorage.getItem("tg_real_id");
    if (cached) {
      _stableId = cached;
      console.log("[Farm] stableId set from tg_real_id cache:", cached);
      return cached;
    }
    const demo = localStorage.getItem("demo_telegram_id");
    if (demo) {
      _stableId = demo;
      console.log("[Farm] stableId set from demo cache:", demo);
      return demo;
    }
  } catch {}

  // Только в крайнем случае — demo ID
  const newId = "demo_" + Math.floor(Math.random() * 10000);
  try { localStorage.setItem("demo_telegram_id", newId); } catch {}
  _stableId = newId;
  console.warn("[Farm] stableId generated as demo:", newId);
  return newId;
}

async function fetchFarm(telegramId: string): Promise<FarmData> {
  const { username, firstName } = getTelegramUser();
  const url = `${API_BASE}/api/farm/${telegramId}`;
  console.log("[Farm] fetchFarm →", telegramId);
  const res = await fetch(url, {
    headers: {
      "x-telegram-username": safeHeader(username),
      "x-telegram-firstname": safeHeader(firstName),
    },
  });
  if (!res.ok) throw new Error(`Ошибка загрузки фермы (${res.status})`);
  const data: FarmData = await res.json();
  console.log("[Farm] fetchFarm ← telegramId:", data.telegramId, "plots:", data.plots?.length, "coins:", data.coins);
  return data;
}

async function postAction(telegramId: string, data: FarmAction): Promise<FarmData> {
  console.log("[Farm] postAction →", telegramId, data.action);
  const res = await fetch(`${API_BASE}/api/farm/${telegramId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Неизвестная ошибка" }));
    throw new Error(err.error || "Ошибка действия");
  }
  const result: FarmData = await res.json();
  console.log("[Farm] postAction ← action:", data.action, "telegramId:", result.telegramId, "plots:", result.plots?.length, "coins:", result.coins);
  return result;
}

export function useFarm() {
  const telegramId = getStableTelegramId();
  return useQuery<FarmData>({
    queryKey: ["farm", telegramId],
    queryFn: () => fetchFarm(telegramId),
    retry: 1,
    placeholderData: keepPreviousData,
  });
}

export function useFarmAction() {
  const telegramId = getStableTelegramId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation<FarmData, Error, FarmAction>({
    mutationFn: (data) => postAction(telegramId, data),
    onMutate: () => {
      hapticFeedback("medium");
    },
    onSuccess: (data, variables) => {
      // Защита: не перезаписывать кеш если ответ содержит чужой telegramId
      if (data.telegramId && data.telegramId !== telegramId) {
        console.warn("Farm response telegramId mismatch, ignoring cache update");
        return;
      }
      queryClient.setQueryData(["farm", telegramId], data);
      if (variables.action === "harvest") hapticFeedback("success");
      else if (variables.action === "collect_product") hapticFeedback("success");
      else if (variables.action === "collect_craft") hapticFeedback("success");
      else if (variables.action === "complete_npc_order") {
        hapticFeedback("success");
        toast({ title: "Заказ выполнен! 🎉", description: "Монеты зачислены на счёт." });
      } else if (variables.action === "claim_quest") {
        hapticFeedback("success");
        toast({ title: "Награда получена! ⭐" });
      } else if (variables.action === "claim_all_quests") {
        hapticFeedback("success");
        toast({ title: "Все награды получены! 🎁", description: "Монеты и XP зачислены." });
      } else if (variables.action === "buy_animal") {
        toast({ title: "Новое животное! 🐾", description: "Скорее покорми его!" });
      } else if (variables.action === "build_building") {
        toast({ title: "Здание построено! 🏗️" });
      } else if (variables.action === "buy_seeds") {
        toast({ title: "Семена куплены! 🌱" });
      } else if (variables.action === "sell_crops" || variables.action === "sell_product") {
        hapticFeedback("success");
        toast({ title: "Продано! 🪙" });
      } else if (variables.action === "sell_all") {
        hapticFeedback("success");
        toast({ title: "Весь урожай продан! 🪙" });
      } else if (variables.action === "redeem_promo") {
        hapticFeedback("success");
        toast({ title: "Промокод активирован! 🎉" });
      } else if (variables.action === "set_ref_code") {
        hapticFeedback("success");
        toast({ title: "Реферальный код сохранён! 🔗" });
      } else if (variables.action === "buy_energy") {
        hapticFeedback("success");
        toast({ title: "Энергия пополнена! ⚡" });
      } else if (variables.action === "expand_plots") {
        hapticFeedback("success");
        toast({ title: "Поле расширено! 🌾", description: "Добавлены новые грядки." });
      } else if (variables.action === "claim_streak_reward") {
        hapticFeedback("success");
        toast({ title: "Награда за стрик получена! 🔥" });
      } else if (variables.action === "claim_achievement") {
        hapticFeedback("success");
        toast({ title: "Достижение засчитано! 🏆" });
      } else if (variables.action === "upgrade_tool") {
        hapticFeedback("success");
        toast({ title: "Инструмент улучшен! ⬆️" });
      } else if (variables.action === "buy_premium_pass") {
        hapticFeedback("success");
        toast({ title: "Пасс активирован! 🏆", description: "Теперь доступны эксклюзивные награды!" });
      } else if (variables.action === "claim_pass_reward") {
        hapticFeedback("success");
        toast({ title: "Награда пасса получена! 🎁" });
      } else if (variables.action === "buy_pet") {
        hapticFeedback("success");
        toast({ title: "Питомец куплен! 🐾", description: "Активируй его в коллекции." });
      } else if (variables.action === "activate_pet") {
        hapticFeedback("success");
        toast({ title: variables.petType ? "Питомец активирован! ✨" : "Питомец отключён" });
      } else if (variables.action === "unlock_skill") {
        hapticFeedback("success");
        toast({ title: "Навык изучен! 🧠" });
      } else if (variables.action === "buy_item") {
        hapticFeedback("success");
        const itemEmoji = variables.itemType === "watering_can" ? "🪣" : variables.itemType === "sprinkler" ? "💦" : variables.itemType === "fertilizer" ? "🌱" : "⚡";
        toast({ title: `${itemEmoji} Куплено!`, description: `${variables.quantity} шт. в инвентаре.` });
      } else if (variables.action === "use_item") {
        hapticFeedback("success");
      }
    },
    onError: (error) => {
      hapticFeedback("error");
      toast({ variant: "destructive", title: "Ошибка", description: error.message });
    },
  });

  const mutate = useCallback(
    (data: FarmAction, callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
      mutation.mutate(data, callbacks);
    },
    [mutation.mutate]
  );

  return { ...mutation, mutate };
}
