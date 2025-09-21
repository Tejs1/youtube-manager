"use client";

import { Moon, Sun } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/hooks/use-theme";

export function SimpleThemeToggle() {
	const { toggleTheme, isDark } = useTheme();

	return (
		<Toggle
			pressed={isDark}
			onPressedChange={toggleTheme}
			aria-label="Toggle theme"
			size="default"
			className="size-9"
		>
			<Sun className="dark:-rotate-90 size-4 rotate-0 scale-100 transition-all dark:scale-0" />
			<Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
		</Toggle>
	);
}
