# Usage Examples - New Components

## 🎨 BackgroundEffects

### Basic Usage (Homepage)

```tsx
import { BackgroundEffects } from "@/components/ui/BackgroundEffects";

export default function HomePage() {
  return (
    <>
      <BackgroundEffects />
      <main>{/* Your content */}</main>
    </>
  );
}
```

### Hero Shimmer Effect

```tsx
import { HeroShimmer } from "@/components/ui/BackgroundEffects";

export function Hero() {
  return (
    <div className="relative hero-glow">
      <HeroShimmer />
      {/* Hero content */}
    </div>
  );
}
```

---

## 🔘 RippleButton

### Replace Standard Buttons

```tsx
import { RippleButton } from "@/components/ui/RippleButton";

export function ActionButton() {
  return (
    <RippleButton
      className="bg-brand px-6 py-3 rounded-[3px] text-white"
      onClick={() => console.log("Clicked!")}
    >
      Click Me
    </RippleButton>
  );
}
```

### With Form Submission

```tsx
<RippleButton
  type="submit"
  className="btn-enhanced bg-brand px-6 py-3"
  disabled={isLoading}
>
  {isLoading ? "Submitting..." : "Submit"}
</RippleButton>
```

---

## 💀 Skeleton Loading

### Leaderboard Loading State

```tsx
import { LeaderboardSkeleton } from "@/components/ui/Skeleton";

export function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  if (loading) {
    return <LeaderboardSkeleton rows={10} />;
  }

  return <Leaderboard data={data} />;
}
```

### Clip Cards Loading

```tsx
import { ClipCardSkeleton } from "@/components/ui/Skeleton";

export function ClipsSection() {
  const { clips, isLoading } = useClips();

  if (isLoading) {
    return <ClipCardSkeleton count={8} />;
  }

  return <ClipCarousel clips={clips} />;
}
```

### Game Cards Loading

```tsx
import { GameCardSkeleton } from "@/components/ui/Skeleton";

export function GamesLobby() {
  const { games, loading } = useGames();

  if (loading) {
    return <GameCardSkeleton count={5} />;
  }

  return <GameGrid games={games} />;
}
```

### Custom Skeleton

```tsx
import { Skeleton } from "@/components/ui/Skeleton";

export function CustomLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton variant="circle" className="h-16 w-16" />
    </div>
  );
}
```

---

## 📊 Progress Indicators

### Linear Progress Bar

```tsx
import { Progress } from "@/components/ui/Progress";

export function UploadProgress() {
  const [progress, setProgress] = useState(0);

  return (
    <div className="w-full">
      <p className="mb-2 text-sm">Uploading... {progress}%</p>
      <Progress value={progress} max={100} showShimmer size="md" />
    </div>
  );
}
```

### Circular Progress

```tsx
import { CircularProgress } from "@/components/ui/Progress";

export function LoadingCircle() {
  return (
    <div className="flex items-center justify-center">
      <CircularProgress value={75} max={100} size={80} strokeWidth={6} />
    </div>
  );
}
```

### Loading Spinner

```tsx
import { Spinner } from "@/components/ui/Progress";

export function LoadingOverlay() {
  return (
    <div className="flex items-center justify-center p-12">
      <Spinner size="lg" />
    </div>
  );
}
```

### Button with Spinner

```tsx
<button disabled={loading} className="flex items-center gap-2">
  {loading && <Spinner size="sm" />}
  {loading ? "Loading..." : "Load More"}
</button>
```

---

## 🔔 Toast Notifications

### Setup (Root Layout)

```tsx
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
```

### Using Toasts

```tsx
"use client";

import { useToast, toast } from "@/components/ui/Toast";

export function ActionComponent() {
  const { showToast } = useToast();

  const handleSuccess = () => {
    showToast(
      toast.success(
        "Action completed!",
        "Your changes have been saved successfully.",
        5000, // duration in ms
      ),
    );
  };

  const handleError = () => {
    showToast(
      toast.error(
        "Something went wrong",
        "Please try again later.",
        0, // 0 = don't auto-hide
      ),
    );
  };

  const handleWarning = () => {
    showToast(
      toast.warning("Low balance", "You have less than 100 MC remaining."),
    );
  };

  const handleInfo = () => {
    showToast(
      toast.info("New feature available", "Check out the updated leaderboard!"),
    );
  };

  return (
    <div className="space-x-2">
      <button onClick={handleSuccess}>Success</button>
      <button onClick={handleError}>Error</button>
      <button onClick={handleWarning}>Warning</button>
      <button onClick={handleInfo}>Info</button>
    </div>
  );
}
```

### Toast on Form Submit

```tsx
async function handleSubmit(e: FormEvent) {
  e.preventDefault();

  try {
    await submitForm(data);
    showToast(
      toast.success("Form submitted", "Thank you for your submission!"),
    );
  } catch (error) {
    showToast(toast.error("Submission failed", error.message));
  }
}
```

### Toast on Coin Transaction

```tsx
function handlePurchase() {
  if (balance < price) {
    showToast(
      toast.warning(
        "Insufficient balance",
        `You need ${price - balance} more MC.`,
      ),
    );
    return;
  }

  // Process purchase
  showToast(
    toast.success(
      "Purchase successful!",
      `You bought ${itemName} for ${price} MC.`,
    ),
  );
}
```

---

## 🎨 Using CSS Classes

### Stagger Animation

```tsx
export function List({ items }) {
  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn("p-4 border-b", index < 10 && "stagger-item")}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
```

### Enhanced Card

```tsx
export function Card({ children }) {
  return (
    <div className="card-hover shadow-elevated rounded-[3px] border border-line p-6">
      {children}
    </div>
  );
}
```

### Glass Effect

```tsx
export function GlassCard({ children }) {
  return <div className="glass-enhanced p-6">{children}</div>;
}
```

### Coin Animation

```tsx
export function CoinDisplay({ amount }) {
  return (
    <div className="flex items-center gap-2">
      <span className="coin-glow text-2xl">🪙</span>
      <span className="font-mono text-lg">{amount}</span>
    </div>
  );
}
```

### Bouncing Entrance

```tsx
export function Achievement({ title }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="bounce-in bg-gold-bg border border-gold-line p-4">
      🏆 {title}
    </div>
  );
}
```

---

## 🎯 Complete Component Example

### Enhanced Action Card

```tsx
"use client";

import { useState } from "react";
import { RippleButton } from "@/components/ui/RippleButton";
import { Progress } from "@/components/ui/Progress";
import { useToast, toast } from "@/components/ui/Toast";

export function ActionCard() {
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleAction = async () => {
    setLoading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setLoading(false);
          showToast(
            toast.success("Action completed!", "Everything went smoothly."),
          );
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="card-hover shadow-elevated rounded-[3px] border border-line p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">Enhanced Action</h3>

      {loading && (
        <div className="mb-4">
          <Progress value={progress} max={100} showShimmer />
        </div>
      )}

      <RippleButton
        onClick={handleAction}
        disabled={loading}
        className="btn-enhanced bg-brand text-white px-6 py-3 rounded-[3px] w-full"
      >
        {loading ? "Processing..." : "Start Action"}
      </RippleButton>
    </div>
  );
}
```

---

## 🎬 Animation Combinations

### Card Grid with Stagger

```tsx
export function CardGrid({ items }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "card-hover shadow-elevated p-6",
            index < 10 && "stagger-item",
          )}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
```

### Slide-in Sections

```tsx
export function Section({ children, direction = "up" }) {
  return <section className={`slide-in-${direction}`}>{children}</section>;
}
```

### Animated List

```tsx
export function AnimatedList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="stagger-item hover:bg-surface-2 p-3 rounded transition-colors"
        >
          {item.text}
        </li>
      ))}
    </ul>
  );
}
```

---

## 💡 Pro Tips

### 1. Combine Effects

```tsx
<div className="card-hover shadow-elevated glass-enhanced stagger-item">
  Multiple effects!
</div>
```

### 2. Conditional Animations

```tsx
className={cn(
  'card',
  isNew && 'bounce-in',
  isHovered && 'shadow-elevated-hover'
)}
```

### 3. Control Stagger

```tsx
// Only animate first 5 items
{
  index < 5 && "stagger-item";
}
```

### 4. Chain Toasts

```tsx
showToast(toast.info("Processing...", undefined, 2000));
setTimeout(() => {
  showToast(toast.success("Done!"));
}, 2000);
```

---

## 🚀 Next Level

### Custom Animation

```tsx
// In your component CSS
@keyframes custom-slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.custom-animation {
  animation: custom-slide 0.5s ease-out;
}
```

### Dynamic Progress

```tsx
const [progress, setProgress] = useState(0);

useEffect(() => {
  // Real-time updates
  const unsubscribe = onProgressUpdate((value) => {
    setProgress(value);
  });
  return unsubscribe;
}, []);
```

---

Happy coding! 🎉
