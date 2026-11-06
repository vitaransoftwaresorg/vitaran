-- School/teacher can propose the correct option(s), ADD marks, or no right answer.
ALTER TABLE "answer_key_objections"
ADD COLUMN "proposed_answer" VARCHAR(16);
