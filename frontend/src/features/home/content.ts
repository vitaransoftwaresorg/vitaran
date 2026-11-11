import {
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  Compass,
  Factory,
  Layers,
  Lightbulb,
  MonitorPlay,
  Palette,
  PenTool,
  Rocket,
  School,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Teachers Resources", href: "/teacher/resources" },
  { label: "Answer Keys", href: "/teacher/answer-keys" },
  { label: "Results", href: "/teacher/results" },
] as const;

type Service = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const services: Service[] = [
  {
    icon: BookOpenCheck,
    title: "Curriculum & Course Development",
    description:
      "End-to-end curriculum and course content, from learning objectives and syllabus mapping to polished, ready-to-teach material for every grade and level.",
  },
  {
    icon: MonitorPlay,
    title: "E-Learning Content",
    description:
      "Interactive digital lessons and modules that keep learners engaged.",
  },
  {
    icon: Compass,
    title: "Instructional Design",
    description:
      "Evidence-based learning experiences shaped around how people actually learn and retain.",
  },
  {
    icon: ClipboardCheck,
    title: "Assessment",
    description:
      "Question banks, rubrics and evaluations that measure real understanding, not just recall.",
  },
  {
    icon: Palette,
    title: "Art & Production",
    description:
      "Illustration, animation, layout and graphic production that brings content to life.",
  },
];

type Audience = {
  icon: LucideIcon;
  title: string;
  description: string;
  points: string[];
};

export const audiences: Audience[] = [
  {
    icon: Building2,
    title: "Corporates",
    description:
      "Upskill teams with onboarding, compliance and leadership programmes designed for impact.",
    points: ["Onboarding journeys", "Compliance training", "Leadership programmes"],
  },
  {
    icon: Factory,
    title: "Industries",
    description:
      "Practical, role-based training for technical workforces, from the floor to the field.",
    points: ["Skill-based modules", "Safety & process training", "Simulations"],
  },
  {
    icon: School,
    title: "K-12",
    description:
      "Curriculum-aligned content, assessments and teacher resources for every classroom.",
    points: ["Curriculum content", "Assessments", "Teacher resources"],
  },
];

type Pillar = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const pillars: Pillar[] = [
  {
    icon: Lightbulb,
    title: "State-of-the-art innovation",
    description:
      "We adopt innovative methods to produce learning content suitable for every type of learner.",
  },
  {
    icon: Target,
    title: "Commitment to excellence",
    description:
      "Excellence is about the impact we create. We consistently deliver value and anticipate our customers' needs.",
  },
  {
    icon: Users,
    title: "Cross-disciplinary collaboration",
    description:
      "Subject experts, instructional designers, writers and artists work as one team to reduce risk and raise quality.",
  },
];

export const themes = [
  "Continuous Learning",
  "Expert-Led Innovation",
  "Impactful Solutions",
  "Creative Expression",
  "Sustainable Design",
  "Cross-Disciplinary Collaboration",
];

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export const processSteps: Step[] = [
  {
    icon: Compass,
    title: "Discover",
    description:
      "We understand your learners, goals and constraints to define what success looks like.",
  },
  {
    icon: PenTool,
    title: "Design",
    description:
      "Instructional designers map outcomes into storyboards, prototypes and assessment plans.",
  },
  {
    icon: Layers,
    title: "Develop",
    description:
      "Subject experts, writers and artists create rich, accurate and engaging learning content.",
  },
  {
    icon: Rocket,
    title: "Deliver",
    description:
      "Content goes through rigorous review, then reaches you in print-ready and digital formats.",
  },
];
