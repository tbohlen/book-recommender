import { State } from "../types/state";

export default function Display({ state }: { state: State }) {
  // Patt, your display should be rendered here.
  return (
    <div className="w-full h-full bg-stone-400">
      {JSON.stringify(state)}
    </div>
  );
}