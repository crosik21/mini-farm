import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X } from "lucide-react";

const ONBOARDING_KEY = "mini_farm_onboarded_v1";

const STEPS = [
  {
    emoji: "🌾",
    title: "Добро пожаловать\nна Мини-Ферму!",
    desc: "Выращивай культуры, торгуй на рынке, лови рыбу и прокачивай своё хозяйство. Давай покажем тебе, как начать!",
    bg: "from-green-500/20 to-emerald-500/10",
    accent: "text-green-600 dark:text-green-400",
    ring: "ring-green-400/30",
  },
  {
    emoji: "🪴",
    title: "Посади первую\nкультуру",
    desc: "Нажми на любую пустую клетку на поле — откроется выбор семян. Выбери культуру и посади. Она начнёт расти сама!",
    bg: "from-lime-500/20 to-green-500/10",
    accent: "text-lime-600 dark:text-lime-400",
    ring: "ring-lime-400/30",
    hint: "💡 Начни с морковки или пшеницы — они самые быстрые",
  },
  {
    emoji: "✂️",
    title: "Собери урожай",
    desc: "Когда культура созреет, она засветится. Нажми на неё, чтобы собрать. Получишь монеты 🪙, опыт и материалы.",
    bg: "from-yellow-500/20 to-orange-500/10",
    accent: "text-yellow-600 dark:text-yellow-400",
    ring: "ring-yellow-400/30",
    hint: "💡 Не запускай поле — перезревший урожай портится!",
  },
  {
    emoji: "🏪",
    title: "Магазин и\nресурсы",
    desc: "Во вкладке «Магазин» покупай семена, удобрения и инструменты. Монеты зарабатывай сбором урожая, кристаллы — за особые достижения.",
    bg: "from-blue-500/20 to-cyan-500/10",
    accent: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-400/30",
    hint: "💡 Удобрения ускоряют рост культур в 2 раза",
  },
  {
    emoji: "🎯",
    title: "Квесты и\nстрики",
    desc: "Выполняй ежедневные задания — они приносят бонусы. Заходи каждый день, чтобы не сломать стрик. Чем дольше серия, тем больше наград!",
    bg: "from-purple-500/20 to-violet-500/10",
    accent: "text-purple-600 dark:text-purple-400",
    ring: "ring-purple-400/30",
    hint: "💡 Квесты и стрик смотри во вкладке «Профиль»",
  },
];

export function useOnboarding() {
  const [done, setDone] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) === "1"; }
    catch { return true; }
  });

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    setDone(true);
  };

  return { showOnboarding: !done, finishOnboarding: finish };
}

export function OnboardingOverlay({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const advance = () => {
    if (isLast) { onFinish(); return; }
    go(step + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFinish}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 24, stiffness: 280 }}
        className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden ring-1 ring-border"
      >
        {/* Skip button */}
        <button
          onClick={onFinish}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground transition-colors"
        >
          <X size={15} />
        </button>

        {/* Slide area */}
        <div className={`bg-gradient-to-br ${current.bg} px-6 pt-8 pb-5`}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.22 }}
              className="text-center"
            >
              {/* Big emoji */}
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-background/60 ring-4 ${current.ring} text-4xl mb-4 shadow-sm`}>
                {current.emoji}
              </div>

              {/* Title */}
              <h2 className={`text-xl font-black leading-tight mb-3 whitespace-pre-line ${current.accent}`}>
                {current.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-foreground/80 leading-relaxed">
                {current.desc}
              </p>

              {/* Hint */}
              {current.hint && (
                <div className="mt-3 text-xs text-muted-foreground bg-background/50 rounded-xl px-3 py-2 text-left">
                  {current.hint}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="px-6 py-4 flex items-center gap-3">
          {/* Dot indicators */}
          <div className="flex gap-1.5 flex-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? `w-6 ${current.accent.replace("text-", "bg-")}` : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Next / Finish */}
          <button
            onClick={advance}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95 text-white shadow-md ${
              isLast
                ? "bg-green-500 hover:bg-green-600"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            {isLast ? "Начать!" : "Далее"}
            <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
