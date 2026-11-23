import {
  Layers,
  Medal,
  RefreshCw,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
export type ProgramContent = {
  id: string;
  icon: LucideIcon;
  /** Also the key used in `solutionBooks`. */
  title: string;
};

export const programs: ProgramContent[] = [
  { id: "INTEGRATED", icon: Layers, title: "New Integrated Program" },
  { id: "ADVANCED", icon: TrendingUp, title: "New Advanced Program" },
  { id: "REVISED_ADVANCED", icon: RefreshCw, title: "Revised Advanced Program" },
  { id: "OLYMPIAD", icon: Trophy, title: "New Olympiad Program" },
  { id: "OLYMPIAD_PRIMARY", icon: Medal, title: "Olympiad Program Class 1 to 5" },
  /** Classic Integrated — PDFs under /solution-books/classic-integrated/ */
  { id: "INTEGRATED_CLASSIC", icon: Layers, title: "Integrated Program" },
  /** Classic Advanced — PDFs under /solution-books/classic-advanced/ */
  { id: "ADVANCED_CLASSIC", icon: TrendingUp, title: "Advanced Program" },
  /** Classic Olympiad — PDFs under /solution-books/classic-olympiad/ */
  { id: "OLYMPIAD_CLASSIC", icon: Trophy, title: "Olympiad Program" },
];
