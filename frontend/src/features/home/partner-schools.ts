/** Static partner schools for the homepage marquee (files live in `public/school-logos`). */
export type PartnerSchool = {
  id: string;
  name: string;
  logoSrc: string;
};

export const PARTNER_SCHOOLS: PartnerSchool[] = [
  { id: "dps", name: "Delhi Public School", logoSrc: "/school-logos/dps_logo.jpeg" },
  { id: "aditi", name: "Mallya Aditi International", logoSrc: "/school-logos/aditi_mallaya_school.png" },
  { id: "gitanjali", name: "Gitanjali Senior School", logoSrc: "/school-logos/geetanjali_school.png" },
  { id: "st-mary", name: "St. Mary's High School", logoSrc: "/school-logos/st_mary_school.png" },
  { id: "jsg", name: "Johnson Grammar School", logoSrc: "/school-logos/JSG-IBPYP-Logo.png" },
  { id: "vidyashilp", name: "Vidyashilp School", logoSrc: "/school-logos/vidyashilp_school.webp" },
  { id: "doon", name: "The Doon School", logoSrc: "/school-logos/doon_school.png" },
  { id: "sri-chaitanya", name: "Sri Chaitanya", logoSrc: "/school-logos/srichaitanya.avif" },
  { id: "bishop-cotton", name: "Bishop Cotton School", logoSrc: "/school-logos/Bishop_Cotton_Schools_crest.png" },
  { id: "oakridge", name: "Oakridge International", logoSrc: "/school-logos/oakridge_logo.jpeg" },
  { id: "chirec", name: "CHIREC International", logoSrc: "/school-logos/CHIREC_International.png" },
  { id: "pragati-meliora", name: "Pragati Meliora World School", logoSrc: "/school-logos/Pragati_Meliora_world_school.jpeg" },
  { id: "pragathi-pathways", name: "Pragathi Pathways School", logoSrc: "/school-logos/Pragathi_pathways_school.jpeg" },
  { id: "pragathi-central", name: "Pragathi Central School", logoSrc: "/school-logos/Pragathi_Central_School.jpeg" },
  { id: "pragati-holistic", name: "Pragati Holistic School", logoSrc: "/school-logos/Pragati_Holistic_School.jpeg" },
];
