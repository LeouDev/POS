"use client";

import { createContext, use } from "react";
import type { UiTheme } from "@/lib/database.types";

/** The signed-in owner's appearance, provided by the app shell. */
export const ThemeContext = createContext<UiTheme>("classic");

/** True in the White and Black appearances (iOS style), false in the original Windows 98 look. */
export const useIos = () => use(ThemeContext) !== "classic";
