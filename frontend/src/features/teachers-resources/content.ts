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
  { id: "INTEGRATED", icon: Layers, title: "Integrated Program" },
  { id: "ADVANCED", icon: TrendingUp, title: "Advanced Program" },
  { id: "REVISED_ADVANCED", icon: RefreshCw, title: "Revised Advanced Program" },
  { id: "OLYMPIAD", icon: Trophy, title: "Olympiad Program" },
  { id: "OLYMPIAD_PRIMARY", icon: Medal, title: "Olympiad Program Class 1 to 5" },
];
