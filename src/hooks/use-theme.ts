"use client";

import { useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";

export function useTheme() {
	const { theme, setTheme, systemTheme } = useNextTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Prevent hydration mismatch by returning null until mounted
	if (!mounted) {
		return {
			theme: undefined,
			setTheme,
			systemTheme: undefined,
			resolvedTheme: undefined,
			toggleTheme: () => {},
			isDark: false,
			isLight: false,
			isSystem: false,
		};
	}

	const resolvedTheme = theme === "system" ? systemTheme : theme;
	const isDark = resolvedTheme === "dark";
	const isLight = resolvedTheme === "light";
	const isSystem = theme === "system";

	const toggleTheme = () => {
		setTheme(isDark ? "light" : "dark");
	};

	return {
		theme,
		setTheme,
		systemTheme,
		resolvedTheme,
		toggleTheme,
		isDark,
		isLight,
		isSystem,
	};
}
