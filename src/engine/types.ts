export type Color = "red" | "green" | "blue";
export type Gender = "man" | "woman";

export type PersonId =
  | "red-man"
  | "red-woman"
  | "green-man"
  | "green-woman"
  | "blue-man"
  | "blue-woman";

export interface Person {
  id: PersonId;
  color: Color;
  gender: Gender;
}

export const COLORS: Color[] = ["red", "green", "blue"];

export const ROSTER: Person[] = COLORS.flatMap((color) => [
  { id: `${color}-man` as PersonId, color, gender: "man" as Gender },
  { id: `${color}-woman` as PersonId, color, gender: "woman" as Gender },
]);

export const ALL_PERSON_IDS: PersonId[] = ROSTER.map((person) => person.id);

const PERSON_BY_ID = new Map(ROSTER.map((person) => [person.id, person]));

export function getPerson(id: PersonId): Person {
  const person = PERSON_BY_ID.get(id);
  if (!person) throw new Error(`Unknown person id: ${id}`);
  return person;
}

export function getPartnerId(id: PersonId): PersonId {
  const person = getPerson(id);
  const partnerGender: Gender = person.gender === "man" ? "woman" : "man";
  return `${person.color}-${partnerGender}` as PersonId;
}
