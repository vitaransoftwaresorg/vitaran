-- OMR exam pattern (MPCB / PCB / MPC) set when adding or editing a class/section.
ALTER TABLE "school_classes"
ADD COLUMN "exam_pattern" VARCHAR(8) NOT NULL DEFAULT 'MPCB';

ALTER TABLE "school_sections"
ADD COLUMN "exam_pattern" VARCHAR(8) NOT NULL DEFAULT 'MPCB';
