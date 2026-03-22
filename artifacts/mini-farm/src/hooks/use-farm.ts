import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

async function fetchFarm(telegramId: string): Promise<FarmData> {
  const { username, firstName } = getTelegramUser();
  const url = `${API_BASE}/api/farm/${telegramId}`;
  const res = await fetch(url, {
    headers: {
      "x-telegram-username": safeHeader(username),
      "x-telegram-firstname": safeHeader(firstName),
    },
  });
  if (!res.ok) throw new Error(`Ошибка загрузки фермы (${res.status})`);
  return res.json();
}

async function postAction(telegramId: string, data: FarmAction): Promise<FarmData> {
  const res = await fetch(`${API_BASE}/api/farm/${telegramId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Неизвестная ошибка" }));
    throw new Error(err.error || "Ошибка действия");
  }
  return res.json();
}

export function useFarm() {
  const telegramId = getTelegramId();
  return useQuery<FarmData>({
    queryKey: ["farm", telegramId],
    queryFn: () => fetchFarm(telegramId),
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 1,
  });
}

export function useFarmAction() {
  const telegramId = getTelegramId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation<FarmData, Error, FarmAction>({
    mutationFn: (data) => postAction(telegramId, data),
    onMutate: () => {
      hapticFeedback("medium");
    },
    onSuccess: (data, variables) => {
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
      }
    },
    onError: (error) => {
      hapticFeedback("error");
      toast({ variant: "destructive", title: "Ошибка", description: error.message });
    },
  });

  const mutate = useCallback(
    (data: FarmAction, callbacks?: { onSuccess?: () => void }) => {
      mutation.mutate(data, callbacks);
    },
    [mutation.mutate]
  );

  return { ...mutation, mutate };
}
